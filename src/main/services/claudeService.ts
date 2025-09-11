import { execSync } from 'child_process';
import { existsSync } from 'fs';

import {
  query,
  type SDKMessage,
  type SDKPartialAssistantMessage,
  type SDKAssistantMessage,
  type SDKResultMessage,
} from '@anthropic-ai/claude-code';
import { BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';

import {
  ClaudeQueryOptions,
  ClaudeStreamEvent,
  ClaudeServiceStatus,
  TOOL_ICON_MAP,
  ClaudeEvent,
  ToolUsageInfo,
} from '../../shared/types/claude';

import { TaskManager } from './taskManager';

export class ClaudeService {
  private static instance: ClaudeService;
  private activeQueries: Map<string, AbortController> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private taskManager: TaskManager;
  private claudeExecutablePath: string | undefined;

  private constructor() {
    this.taskManager = TaskManager.getInstance();
    this.claudeExecutablePath = this.findClaudeExecutable();
    if (!this.claudeExecutablePath) {
      console.warn('Claude executable not found in PATH. Claude features may not work.');
    } else {
      console.log('Found Claude executable at:', this.claudeExecutablePath);
    }
  }

  private findClaudeExecutable(): string | undefined {
    // Try to find claude in PATH
    try {
      const claudePath = execSync('which claude', { encoding: 'utf-8' }).trim();
      if (claudePath && existsSync(claudePath)) {
        return claudePath;
      }
    } catch (_error) {
      // which command failed, try common locations
    }

    // Check common installation locations
    const commonPaths = [
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
      '/usr/bin/claude',
      `${process.env.HOME}/.local/bin/claude`,
    ];

    for (const path of commonPaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    return undefined;
  }

  public static getInstance(): ClaudeService {
    if (!ClaudeService.instance) {
      ClaudeService.instance = new ClaudeService();
    }
    return ClaudeService.instance;
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  public async sendMessage(
    taskId: string,
    userMessage: string,
    options?: Partial<ClaudeQueryOptions>
  ): Promise<{ messageId: string }> {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Note: User message is already added by the frontend
    // We only need to create and add assistant message placeholder
    const assistantMessage = this.taskManager.addMessage(taskId, {
      role: 'assistant',
      content: '',
      metadata: {
        isStreaming: true,
        events: [],
      },
    });

    if (!assistantMessage) {
      throw new Error('Failed to add assistant message');
    }

    const assistantMessageId = assistantMessage.id;

    // Set up abort controller for cancellation
    const abortController = new AbortController();
    this.activeQueries.set(assistantMessageId, abortController);

    // Start the Claude query in the background
    this.executeClaudeQuery(
      taskId,
      assistantMessageId,
      userMessage,
      task.worktreeBasePath,
      options,
      abortController.signal
    );

    return { messageId: assistantMessageId };
  }

  private async executeClaudeQuery(
    taskId: string,
    messageId: string,
    prompt: string,
    workingDirectory: string,
    options: Partial<ClaudeQueryOptions> = {},
    signal: AbortSignal
  ): Promise<void> {
    try {
      let fullContent = '';
      const events: ClaudeEvent[] = [];
      let lastUpdateTime = Date.now();

      // Configure query options
      const queryOptions: any = {
        maxTurns: options.maxTurns || 10,
        includePartialMessages: true,
        allowedTools: options.allowedTools || [
          'Read',
          'Write',
          'Edit',
          'MultiEdit',
          'Bash',
          'BashOutput',
          'KillBash',
          'Grep',
          'Glob',
          'WebSearch',
          'WebFetch',
          'Task',
          'TodoWrite',
          'NotebookEdit',
          'ExitPlanMode',
        ],
        appendSystemPrompt:
          options.appendSystemPrompt ||
          `You are working in the directory: ${workingDirectory}. All file operations should be relative to this directory.`,
        cwd: workingDirectory,
      };

      // Add path to Claude executable if found
      if (this.claudeExecutablePath) {
        queryOptions.pathToClaudeCodeExecutable = this.claudeExecutablePath;
      } else {
        throw new Error('Claude executable not found. Please ensure Claude is installed and available in your PATH.');
      }

      // Process the query with streaming
      for await (const message of query({ prompt, options: queryOptions }) as AsyncIterable<SDKMessage>) {
        // Check if cancelled
        if (signal.aborted) {
          this.sendEvent(taskId, messageId, {
            type: 'error',
            error: 'Query cancelled',
            messageId,
          });
          break;
        }

        const now = Date.now();
        const shouldUpdate = now - lastUpdateTime > 50; // Throttle updates to every 50ms

        // Handle different message types
        if (message.type === 'stream_event') {
          const streamMsg = message as SDKPartialAssistantMessage;
          // Handle partial content updates from streaming
          if (streamMsg.event && 'text' in streamMsg.event) {
            fullContent = (streamMsg.event as any).text || '';

            if (shouldUpdate) {
              this.sendEvent(taskId, messageId, {
                type: 'partial',
                content: fullContent,
                messageId,
              });
              lastUpdateTime = now;
            }
          }

          // Handle tool usage events
          if (streamMsg.event && 'content_block' in streamMsg.event) {
            const contentBlock = (streamMsg.event as any).content_block;
            if (contentBlock?.type === 'tool_use') {
              const toolEvent = this.createToolEvent(contentBlock);
              events.push(toolEvent);

              this.sendEvent(taskId, messageId, {
                type: 'tool_start',
                toolName: contentBlock.name,
                toolParams: contentBlock.input,
                messageId,
              });
            }
          }
        } else if (message.type === 'assistant') {
          // Final assistant message
          const assistantMsg = message as SDKAssistantMessage;
          if (assistantMsg.message && assistantMsg.message.content) {
            const content = assistantMsg.message.content;
            if (Array.isArray(content)) {
              fullContent = content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('');
            } else if (typeof content === 'string') {
              fullContent = content;
            }
          }
        } else if (message.type === 'result') {
          // Conversation complete
          const resultMsg = message as SDKResultMessage;
          if (resultMsg.subtype === 'success' && resultMsg.result) {
            fullContent = resultMsg.result;
          } else if (resultMsg.subtype === 'error_during_execution' || resultMsg.subtype === 'error_max_turns') {
            this.sendEvent(taskId, messageId, {
              type: 'error',
              error: `Query failed: ${resultMsg.subtype}`,
              messageId,
            });
          }
        }
      }

      // Update the final message in the task
      const task = this.taskManager.getTask(taskId);
      if (task) {
        const messages = task.messages.map((msg) => {
          // Only update the specific message with matching ID
          if (msg.id === messageId) {
            return {
              ...msg,
              content: fullContent,
              metadata: {
                ...msg.metadata,
                isStreaming: false,
                events,
              },
            };
          }
          return msg;
        });

        this.taskManager.updateTask(taskId, { messages });
      }

      // Send completion event
      this.sendEvent(taskId, messageId, {
        type: 'complete',
        content: fullContent,
        messageId,
      });

      // Force a refresh of the task to ensure UI updates
      const updatedTask = this.taskManager.getTask(taskId);
      if (updatedTask && this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('task:updated', taskId, updatedTask);
      }
    } catch (error) {
      console.error('Claude query error:', error);
      this.sendEvent(taskId, messageId, {
        type: 'error',
        error: error.message || 'Query failed',
        messageId,
      });
    } finally {
      // Clean up the active query
      this.activeQueries.delete(messageId);
    }
  }

  private createToolEvent(toolUse: any): ClaudeEvent {
    const toolInfo: ToolUsageInfo = {
      name: toolUse.name,
      parameters: toolUse.input,
      status: 'started',
      icon: TOOL_ICON_MAP[toolUse.name] || TOOL_ICON_MAP.default,
    };

    return {
      id: uuidv4(),
      type: 'tool_use',
      tool: toolInfo,
      timestamp: new Date(),
    };
  }

  private sendEvent(taskId: string, messageId: string, event: ClaudeStreamEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('claude:stream-event', taskId, messageId, event);
    }
  }

  public cancelQuery(messageId: string): boolean {
    const controller = this.activeQueries.get(messageId);
    if (controller) {
      controller.abort();
      this.activeQueries.delete(messageId);
      return true;
    }
    return false;
  }

  public getStatus(): ClaudeServiceStatus {
    return {
      isRunning: this.activeQueries.size > 0,
      currentTaskId: this.activeQueries.size > 0 ? Array.from(this.activeQueries.keys())[0] : undefined,
    };
  }

  public cancelAllQueries(): void {
    for (const [_messageId, controller] of this.activeQueries) {
      controller.abort();
    }
    this.activeQueries.clear();
  }
}
