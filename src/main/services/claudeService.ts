import { execSync } from 'child_process';
import { existsSync } from 'fs';

import { Options, query, type SDKMessage } from '@anthropic-ai/claude-code';
import { BrowserWindow } from 'electron';

import { ClaudeServiceStatus } from '../../shared/types/claude';
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
    options?: Partial<Options>
  ): Promise<{ sessionId?: string }> {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const abortController = new AbortController();
    this.activeQueries.set(taskId, abortController);

    this.executeClaudeQuery(taskId, userMessage, task, options, abortController.signal);

    return { sessionId: task.sessionId };
  }

  private async executeClaudeQuery(
    taskId: string,
    prompt: string,
    task: Task,
    options: Partial<Options> = {},
    signal: AbortSignal
  ): Promise<void> {
    // Emit query started event
    this.sendStatusEvent(taskId, 'started');

    try {
      const sessionId = task.sessionId;

      const queryOptions: Options = {
        maxTurns: options.maxTurns || 100,
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
          ...(options.permissionMode === 'plan' ? [] : ['ExitPlanMode']),
        ],
        appendSystemPrompt:
          options.appendSystemPrompt ||
          `You are working in the directory: ${task.worktreeBasePath}. All file operations should be relative to this directory.`,
        cwd: task.worktreeBasePath,
        permissionMode: options.permissionMode,
        model: options.model,
        maxThinkingTokens: options.maxThinkingTokens,
      };

      if (sessionId) {
        queryOptions.resume = sessionId;
      }

      if (this.claudeExecutablePath) {
        queryOptions.pathToClaudeCodeExecutable = this.claudeExecutablePath;
      } else {
        // TODO: Show this to the user
        throw new Error('Claude executable not found. Please ensure Claude is installed and available in your PATH.');
      }

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
    } catch (error) {
      // Emit error status
      this.sendStatusEvent(taskId, 'error');
      throw error;
    } finally {
      // Emit query completed event
      this.sendStatusEvent(taskId, 'completed');
      this.activeQueries.delete(taskId);
    }
  }

  private sendEvent(taskId: string, event: SDKMessage): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('claude:stream-event', taskId, event);
    }
  }

  private sendStatusEvent(taskId: string, status: 'started' | 'completed' | 'error'): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('claude:query-status', taskId, status);
    }
  }

  public cancelQuery(taskId: string): boolean {
    const controller = this.activeQueries.get(taskId);
    if (controller) {
      controller.abort();
      this.activeQueries.delete(taskId);
      // Emit completed status when cancelled
      this.sendStatusEvent(taskId, 'completed');
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
}
