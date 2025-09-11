import { execSync } from 'child_process';
import { existsSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

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
import { Task, ChatMessage } from '../../shared/types/tasks';

import { TaskManager } from './taskManager';

export class ClaudeService {
  private static instance: ClaudeService;
  private activeQueries: Map<string, AbortController> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private taskManager: TaskManager;
  private claudeExecutablePath: string | undefined;
  private logFilePath: string;

  private constructor() {
    this.taskManager = TaskManager.getInstance();
    this.claudeExecutablePath = this.findClaudeExecutable();
    this.initializeLogging();
    if (!this.claudeExecutablePath) {
      console.warn('Claude executable not found in PATH. Claude features may not work.');
    } else {
      this.log('Found Claude executable at:', this.claudeExecutablePath);
    }
  }

  private initializeLogging(): void {
    // Create logs directory in project root
    const logsDir = join(process.cwd(), 'logs');
    try {
      mkdirSync(logsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }

    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = join(logsDir, `claude-${timestamp}.log`);

    // Write initial log entry
    this.writeToLogFile(`[${new Date().toISOString()}] Claude Service initialized`);
    this.writeToLogFile(`Log file: ${this.logFilePath}`);
  }

  private writeToLogFile(message: string): void {
    try {
      appendFileSync(this.logFilePath, message + '\n', 'utf-8');
    } catch (error) {
      // Silently fail if we can't write to log file
      console.error('Failed to write to log file:', error);
    }
  }

  private log(...args: any[]): void {
    // Format the log message
    const message = args
      .map((arg) => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg, null, 2);
        }
        return String(arg);
      })
      .join(' ');

    // Write to console
    console.log(...args);

    // Write to file with timestamp
    const timestampedMessage = `[${new Date().toISOString()}] ${message}`;
    this.writeToLogFile(timestampedMessage);
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
  ): Promise<{ messageId: string; sessionId?: string }> {
    this.log(
      '[Claude Message] Received user message:',
      userMessage.substring(0, 100) + (userMessage.length > 100 ? '...' : '')
    );

    const task = this.taskManager.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    this.log('[Claude Message] Task found:', task.id, 'with', task.messages.length, 'existing messages');

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
    this.executeClaudeQuery(taskId, assistantMessageId, userMessage, task, options, abortController.signal);

    return { messageId: assistantMessageId, sessionId: task.sessionId };
  }

  private async executeClaudeQuery(
    taskId: string,
    messageId: string,
    prompt: string,
    task: Task,
    options: Partial<ClaudeQueryOptions> = {},
    signal: AbortSignal
  ): Promise<void> {
    try {
      let fullContent = '';
      const events: ClaudeEvent[] = [];
      // let lastUpdateTime = Date.now();
      const thinkingBlocks: string[] = [];
      let currentThinkingBlock = '';
      let sessionId = task.sessionId;
      let isInThinkingBlock = false;
      let intermediateText = ''; // Text between tool calls
      let currentToolInputJson = ''; // Accumulate tool input JSON string during streaming
      let currentToolId: string | null = null; // Track current tool being streamed
      let currentToolName: string | null = null; // Track current tool name

      // Build conversation history for context
      const conversationHistory = this.buildConversationHistory(task.messages);

      // Configure query options
      const queryOptions: any = {
        maxTurns: options.maxTurns || 100, // Increased from 10 to 100
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
          // Note: All standard Claude Code tools are included above
          // Additional tools can be added via MCP or custom configurations
        ],
        appendSystemPrompt:
          options.appendSystemPrompt ||
          `You are working in the directory: ${task.worktreeBasePath}. All file operations should be relative to this directory.`,
        cwd: task.worktreeBasePath,
      };

      // If we have a session ID, use it to continue the conversation
      if (sessionId) {
        queryOptions.resume = sessionId;
        this.log('[Claude Setup] Resuming session:', sessionId);
      }

      // If we have conversation history and no session, include it
      if (conversationHistory && !sessionId) {
        queryOptions.messages = conversationHistory;
        this.log('[Claude Setup] Including conversation history:', conversationHistory.length, 'messages');
      }

      // Add path to Claude executable if found
      if (this.claudeExecutablePath) {
        queryOptions.pathToClaudeCodeExecutable = this.claudeExecutablePath;
      } else {
        throw new Error('Claude executable not found. Please ensure Claude is installed and available in your PATH.');
      }

      this.log('[Claude Query] Starting with options:', {
        prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
        maxTurns: queryOptions.maxTurns,
        toolsCount: queryOptions.allowedTools?.length,
        hasSessionId: !!sessionId,
        historyLength: conversationHistory?.length || 0,
        cwd: queryOptions.cwd,
      });

      // Process the query with streaming
      for await (const message of query({ prompt, options: queryOptions }) as AsyncIterable<SDKMessage>) {
        // Log everything Claude outputs
        this.log('[Claude Output]:', JSON.stringify(message, null, 2));

        // Check if cancelled
        if (signal.aborted) {
          this.sendEvent(taskId, messageId, {
            type: 'error',
            error: 'Query cancelled',
            messageId,
          });
          break;
        }

        // const now = Date.now();
        // const shouldUpdate = now - lastUpdateTime > 50; // Throttle updates to every 50ms

        // Handle different message types
        if (message.type === 'system') {
          // System initialization message
          const sysMsg = message as any;
          this.log('[Claude System] Initialized with:', {
            cwd: sysMsg.cwd,
            tools: sysMsg.tools,
            model: sysMsg.model,
            session_id: sysMsg.session_id,
          });

          if (!sessionId && sysMsg.session_id) {
            sessionId = sysMsg.session_id;
            this.taskManager.updateTask(taskId, { sessionId });
          }
        } else if (message.type === 'stream_event') {
          const streamMsg = message as SDKPartialAssistantMessage;

          // Capture session ID from the first message
          if (!sessionId && streamMsg.session_id) {
            sessionId = streamMsg.session_id;
            this.log('[Claude Session] Captured session ID:', sessionId);
            // Update task with session ID
            this.taskManager.updateTask(taskId, { sessionId });
          }

          // Handle different event types within stream_event
          if (streamMsg.event) {
            const event = streamMsg.event as any;

            // Handle content block start events
            if (event.type === 'content_block_start') {
              const contentBlock = event.content_block;

              if (contentBlock?.type === 'thinking') {
                isInThinkingBlock = true;
                currentThinkingBlock = '';
                this.log('[Claude Thinking] Started thinking block');
              } else if (contentBlock?.type === 'tool_use') {
                // If we have intermediate text, save it as a thinking block and reset
                if (intermediateText.trim()) {
                  thinkingBlocks.push(intermediateText.trim());
                  this.log('[Claude Thinking] Saved intermediate text as thinking:', intermediateText.trim());
                  // Don't send a final thinking event here, it was already streamed
                  intermediateText = ''; // Reset for next segment
                }

                currentToolId = contentBlock.id;
                currentToolName = contentBlock.name;
                currentToolInputJson = ''; // Reset for new tool
                this.log('[Claude Tool Use] Started:', contentBlock.name, 'with ID:', contentBlock.id);
                const toolEvent = this.createToolEvent(contentBlock);
                events.push(toolEvent);

                // Send initial tool_start event (params will be updated later)
                this.sendEvent(taskId, messageId, {
                  type: 'tool_start',
                  toolName: contentBlock.name,
                  toolParams: {},
                  toolUseId: contentBlock.id,
                  messageId,
                });
              } else if (contentBlock?.type === 'text') {
                // Regular text content block started
                // If we have accumulated intermediate text, save it and reset
                if (intermediateText.trim()) {
                  thinkingBlocks.push(intermediateText.trim());
                  this.log('[Claude Thinking] Saved intermediate text before new text block:', intermediateText.trim());
                  intermediateText = ''; // Reset for new text block
                }
                this.log('[Claude Text] Text block started');
              }
            }

            // Handle content block delta events (streaming updates)
            else if (event.type === 'content_block_delta') {
              const delta = event.delta;

              if (delta?.type === 'text_delta') {
                if (isInThinkingBlock) {
                  // Accumulate thinking content
                  currentThinkingBlock += delta.text || '';
                  this.sendEvent(taskId, messageId, {
                    type: 'thinking',
                    thinkingContent: currentThinkingBlock,
                    messageId,
                  });
                } else {
                  const textDelta = delta.text || '';

                  // Accumulate intermediate text
                  intermediateText += textDelta;

                  // Send it as thinking content in real-time (all text between tools is thinking)
                  this.sendEvent(taskId, messageId, {
                    type: 'thinking',
                    thinkingContent: intermediateText,
                    messageId,
                  });
                }
              } else if (delta?.type === 'input_json_delta') {
                // Tool input is being streamed - concatenate the fragments
                if (currentToolId && delta.partial_json) {
                  currentToolInputJson += delta.partial_json;
                  this.log('[Claude Tool Input] Accumulating:', delta.partial_json);

                  // Try to parse and send updates as we get more complete JSON
                  try {
                    const toolParams = JSON.parse(currentToolInputJson);
                    // Successfully parsed - send an update
                    this.log('[Claude Tool Use] Sending tool_start update with params:', JSON.stringify(toolParams));
                    this.sendEvent(taskId, messageId, {
                      type: 'tool_start',
                      toolName: currentToolName || '',
                      toolParams: toolParams,
                      toolUseId: currentToolId,
                      messageId,
                    });
                  } catch {
                    // JSON not complete yet, keep accumulating
                  }
                }
              }
            }

            // Handle content block stop events
            else if (event.type === 'content_block_stop') {
              if (isInThinkingBlock) {
                isInThinkingBlock = false;
                if (currentThinkingBlock) {
                  thinkingBlocks.push(currentThinkingBlock);
                  this.log('[Claude Thinking] Completed thinking block:', currentThinkingBlock);
                }
                currentThinkingBlock = '';
              } else if (currentToolId) {
                // Tool input streaming is complete - parse and send the tool_start event
                let toolParams = {};
                try {
                  if (currentToolInputJson) {
                    toolParams = JSON.parse(currentToolInputJson);
                  }
                } catch (e) {
                  this.log('[Claude Tool Use] Failed to parse tool input:', currentToolInputJson, e);
                }

                // Update the tool event with the complete input
                const toolEvent = events.find((e) => e.tool?.id === currentToolId);
                if (toolEvent && toolEvent.tool) {
                  toolEvent.tool.parameters = toolParams;
                }

                this.log('[Claude Tool Use] Sending tool_start with params:', JSON.stringify(toolParams));
                this.sendEvent(taskId, messageId, {
                  type: 'tool_start',
                  toolName: currentToolName || '',
                  toolParams: toolParams,
                  toolUseId: currentToolId,
                  messageId,
                });

                currentToolId = null;
                currentToolName = null;
                currentToolInputJson = '';
              }
            }

            // Handle message start/stop events
            else if (event.type === 'message_start' || event.type === 'message_delta') {
              // Log usage information if available
              if (event.usage) {
                this.log('[Claude Usage]:', event.usage);
              }
            }
          }
        } else if (message.type === 'user') {
          // User message containing tool results
          const userMsg = message as any;
          this.log('[Claude User Message] Processing tool results');

          if (userMsg.message && userMsg.message.content && Array.isArray(userMsg.message.content)) {
            userMsg.message.content.forEach((item: any) => {
              if (item.type === 'tool_result') {
                const toolUseId = item.tool_use_id;
                const toolEvent = events.find((e: any) => e.id === toolUseId || e.tool?.id === toolUseId);

                if (toolEvent && toolEvent.tool) {
                  toolEvent.tool.status = 'completed';
                  toolEvent.tool.result = item.content || '';

                  this.log(
                    '[Claude Tool Result] Tool:',
                    toolEvent.tool.name,
                    'Result:',
                    (item.content || '').substring(0, 200),
                    item.content?.length > 200 ? '...' : ''
                  );

                  this.sendEvent(taskId, messageId, {
                    type: 'tool_result',
                    toolName: toolEvent.tool.name,
                    toolResult: item.content || '',
                    toolUseId: toolUseId,
                    messageId,
                  });

                  this.sendEvent(taskId, messageId, {
                    type: 'tool_end',
                    toolName: toolEvent.tool.name,
                    toolUseId: toolUseId,
                    messageId,
                  });
                }
              }
            });
          }
        } else if (message.type === 'assistant') {
          // Final assistant message
          this.log('[Claude Assistant Message] Type:', message.type);
          const assistantMsg = message as SDKAssistantMessage;
          if (assistantMsg.message && assistantMsg.message.content) {
            const content = assistantMsg.message.content;
            if (Array.isArray(content)) {
              // Process all content blocks, including tool use
              content.forEach((c: any) => {
                if (c.type === 'text') {
                  // Only add text if we haven't been accumulating it from stream
                  if (!fullContent) {
                    fullContent = c.text || '';
                  }
                } else if (c.type === 'tool_use') {
                  // Update or create tool event with final parameters
                  const existingEvent = events.find((e: any) => e.id === c.id || e.tool?.id === c.id);
                  if (existingEvent && existingEvent.tool) {
                    // Update existing event with final parameters
                    existingEvent.tool.parameters = c.input;
                    this.log('[Claude Tool Use] Updated tool:', c.name, 'with final params:', c.input);
                  } else {
                    // Create new event if not found (shouldn't happen with proper streaming)
                    const toolEvent = this.createToolEvent(c);
                    events.push(toolEvent);
                    this.log('[Claude Tool Use] Created new tool event:', c.name);
                  }

                  // Send tool_start event with complete parameters
                  this.log('[Claude Tool Use] Sending tool_start with complete params:', JSON.stringify(c.input));
                  this.sendEvent(taskId, messageId, {
                    type: 'tool_start',
                    toolName: c.name,
                    toolParams: c.input || {},
                    toolUseId: c.id,
                    messageId,
                  });
                }
              });
            } else if (typeof content === 'string') {
              fullContent = content;
            }
          }
        } else if (message.type === 'result') {
          // Conversation complete
          this.log('[Claude Result] Subtype:', (message as SDKResultMessage).subtype);
          const resultMsg = message as SDKResultMessage;
          if (resultMsg.subtype === 'success' && resultMsg.result) {
            // This is the final response content after all tools have run
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

      // Store thinking blocks if any were captured
      if (currentThinkingBlock) {
        thinkingBlocks.push(currentThinkingBlock);
      }

      // If we have any remaining intermediate text, save it as thinking
      if (intermediateText.trim()) {
        thinkingBlocks.push(intermediateText.trim());
        this.log('[Claude Thinking] Saved final intermediate text as thinking:', intermediateText.trim());
      }

      // Update the final message in the task
      const updatedTask = this.taskManager.getTask(taskId);
      if (updatedTask) {
        const messages = updatedTask.messages.map((msg) => {
          // Only update the specific message with matching ID
          if (msg.id === messageId) {
            return {
              ...msg,
              content: fullContent,
              thinkingBlocks: thinkingBlocks.length > 0 ? thinkingBlocks : undefined,
              metadata: {
                ...msg.metadata,
                isStreaming: false,
                events,
              },
            };
          }
          return msg;
        });

        this.taskManager.updateTask(taskId, { messages, sessionId });
      }

      // Send completion event with all accumulated data
      this.log('[Claude Complete] Query finished successfully');
      this.log('[Claude Complete] Final content length:', fullContent.length);
      this.log('[Claude Complete] Total events:', events.length);
      this.log('[Claude Complete] Thinking blocks:', thinkingBlocks.length);

      this.sendEvent(taskId, messageId, {
        type: 'complete',
        content: fullContent,
        events: events,
        thinkingBlocks: thinkingBlocks.length > 0 ? thinkingBlocks : undefined,
        messageId,
      });

      // Force a refresh of the task to ensure UI updates
      const finalTask = this.taskManager.getTask(taskId);
      if (finalTask && this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('task:updated', taskId, finalTask);
      }
    } catch (error) {
      this.log('[Claude Error] Query failed:', error);
      this.log('[Claude Error] Stack trace:', (error as Error).stack);
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
      id: toolUse.id, // Keep the tool's ID for matching results
      name: toolUse.name,
      parameters: toolUse.input || {},
      status: 'started',
      icon: TOOL_ICON_MAP[toolUse.name] || TOOL_ICON_MAP.default,
    };

    return {
      id: toolUse.id || uuidv4(), // Use tool's ID if available for matching results
      type: 'tool_use',
      tool: toolInfo,
      timestamp: new Date(),
    };
  }

  private sendEvent(taskId: string, messageId: string, event: ClaudeStreamEvent): void {
    this.log('[Claude SendEvent] Sending event:', event.type, 'for message:', messageId);
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('claude:stream-event', taskId, messageId, event);
    } else {
      this.log('[Claude SendEvent] WARNING: mainWindow not available');
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

  public getLogFilePath(): string {
    return this.logFilePath;
  }

  public cancelAllQueries(): void {
    for (const [_messageId, controller] of this.activeQueries) {
      controller.abort();
    }
    this.activeQueries.clear();
  }

  private buildConversationHistory(messages: ChatMessage[]): any[] {
    // Build conversation history in the format expected by Claude SDK
    const history: any[] = [];

    for (const msg of messages) {
      if (msg.content) {
        // Add the main message content
        const messageData: any = {
          role: msg.role === 'thinking' ? 'assistant' : msg.role,
          content: msg.content,
        };

        // Include tool events if present
        if (msg.metadata?.events && msg.metadata.events.length > 0) {
          const contentBlocks: any[] = [{ type: 'text', text: msg.content }];

          for (const event of msg.metadata.events) {
            if (event.tool) {
              contentBlocks.push({
                type: 'tool_use',
                id: event.id,
                name: event.tool.name,
                input: event.tool.parameters || {},
              });

              if (event.tool.result) {
                contentBlocks.push({
                  type: 'tool_result',
                  tool_use_id: event.id,
                  content: event.tool.result,
                });
              }
            }
          }

          messageData.content = contentBlocks;
        }

        history.push(messageData);
      }
    }

    return history;
  }
}
