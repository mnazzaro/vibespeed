import { execSync } from 'child_process';
import { existsSync } from 'fs';

import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import { BrowserWindow } from 'electron';

import { ClaudeQueryOptions, ClaudeServiceStatus } from '../../shared/types/claude';
import { Task } from '../../shared/types/tasks';

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
    if (!this.claudeExecutablePath) {
      console.warn('Claude executable not found in PATH. Claude features may not work.');
    } // TODO: Show this to the user
  }

  // TODO: Do this much more robustly
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
  ): Promise<{ sessionId?: string }> {
    const task = this.taskManager.getTask(taskId);
    console.log('Task found:', task);
    if (!task) {
      throw new Error('Task not found');
    }

    // Set up abort controller for cancellation

    const abortController = new AbortController();
    this.activeQueries.set(taskId, abortController);

    // Start the Claude query in the background
    this.executeClaudeQuery(taskId, userMessage, task, options, abortController.signal);

    return { sessionId: task.sessionId };
  }

  private async executeClaudeQuery(
    taskId: string,
    prompt: string,
    task: Task,
    options: Partial<ClaudeQueryOptions> = {},
    signal: AbortSignal
  ): Promise<void> {
    try {
      let sessionId = task.sessionId;

      // Build conversation history for context
      // const conversationHistory = this.buildConversationHistory(task.messages);

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
      } // TODO: Do we need this?

      // // If we have conversation history and no session, include it
      // if (conversationHistory && !sessionId) {
      //   queryOptions.messages = conversationHistory;
      // }

      // Add path to Claude executable if found
      if (this.claudeExecutablePath) {
        queryOptions.pathToClaudeCodeExecutable = this.claudeExecutablePath;
      } else {
        throw new Error('Claude executable not found. Please ensure Claude is installed and available in your PATH.');
      }

      console.log('Sending query to Claude:', queryOptions);
      // Process the query with streaming
      for await (const message of query({ prompt, options: queryOptions }) as AsyncIterable<SDKMessage>) {
        // Check if cancelled
        if (signal.aborted) {
          // this.sendEvent(taskId, {
          //   type: 'result',
          //   is_error: true,
          //   result: 'Query cancelled',
          // });
          // break;
          // TODO: ABORT QUERY
          this.cancelQuery(taskId);
          break;
        }

        this.sendEvent(taskId, message);
      }
    } finally {
      this.activeQueries.delete(taskId);
    }
  }

  private sendEvent(taskId: string, event: SDKMessage): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('claude:stream-event', taskId, event);
    }
  }

  public cancelQuery(taskId: string): boolean {
    const controller = this.activeQueries.get(taskId);
    if (controller) {
      controller.abort();
      this.activeQueries.delete(taskId);
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

  // // TODO: Figure out what we need to do here. Probably nothing w/ session id
  // private buildConversationHistory(messages: ChatMessage[]): any[] {
  //   // Build conversation history in the format expected by Claude SDK
  //   const history: any[] = [];

  //   for (const msg of messages) {
  //     if (msg.content) {
  //       // Add the main message content
  //       const messageData: any = {
  //         role: msg.role,
  //         content: msg.content,
  //       };

  //       // Include tool events if present
  //       if (msg.metadata?.events && msg.metadata.events.length > 0) {
  //         const contentBlocks: any[] = [{ type: 'text', text: msg.content }];

  //         for (const event of msg.metadata.events) {
  //           if (event.tool) {
  //             contentBlocks.push({
  //               type: 'tool_use',
  //               id: event.id,
  //               name: event.tool.name,
  //               input: event.tool.parameters || {},
  //             });

  //             if (event.tool.result) {
  //               contentBlocks.push({
  //                 type: 'tool_result',
  //                 tool_use_id: event.id,
  //                 content: event.tool.result,
  //               });
  //             }
  //           }
  //         }

  //         messageData.content = contentBlocks;
  //       }

  //       history.push(messageData);
  //     }
  //   }

  //   return history;
  // }
}
