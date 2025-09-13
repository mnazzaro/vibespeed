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
  private includePartialSupported: boolean | null = null;

  private constructor() {
    this.taskManager = TaskManager.getInstance();
    // Defer CLI resolution to execution time to avoid packaged-app PATH issues
    console.log('[ClaudeService] Initialized; CLI path will be resolved on first use');
  }

  private findClaudeExecutable(): string | undefined {
    console.log('[ClaudeService] Resolving Claude CLI path...');
    // Try to find claude in PATH via `which`
    try {
      const claudePath = execSync('which claude', { encoding: 'utf-8' }).trim();
      console.log(`[ClaudeService] which claude -> ${claudePath || '(empty)'}`);
      if (claudePath && existsSync(claudePath)) {
        console.log(`[ClaudeService] Confirmed existing path: ${claudePath}`);
        return claudePath;
      }
    } catch (error) {
      console.warn('[ClaudeService] which claude failed; will check common locations', error);
    }

    // Check common installation locations
    const commonPaths = [
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
      '/usr/bin/claude',
      `${process.env.HOME}/.local/bin/claude`,
    ];

    for (const path of commonPaths) {
      try {
        const exists = existsSync(path);
        console.log(`[ClaudeService] Check candidate: ${path} -> ${exists ? 'exists' : 'missing'}`);
        if (exists) {
          console.log(`[ClaudeService] Using candidate path: ${path}`);
          return path;
        }
      } catch (error) {
        console.warn(`[ClaudeService] Error while checking candidate ${path}`, error);
      }
    }

    console.error('[ClaudeService] Claude CLI not found via PATH or common locations');
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

    this.executeClaudeQuery(taskId, userMessage, task, options, abortController.signal).catch((error) => {
      // Prevent unhandled promise rejection warnings in the packaged app
      console.error('[ClaudeService] executeClaudeQuery unhandled error', error);
    });

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

      // Lazily resolve CLI path on first use or when missing
      if (!this.claudeExecutablePath || !existsSync(this.claudeExecutablePath)) {
        console.log('[ClaudeService] CLI path missing or invalid; attempting to resolve...');
        this.claudeExecutablePath = this.findClaudeExecutable();
        if (this.claudeExecutablePath) {
          console.log(`[ClaudeService] Resolved CLI path: ${this.claudeExecutablePath}`);
        } else {
          console.error('[ClaudeService] Failed to resolve Claude CLI during query execution');
        }
      }

      // Detect support for include-partial-messages flag (older CLI versions may not support it)
      if (this.includePartialSupported == null && this.claudeExecutablePath) {
        try {
          const helpText = execSync(`${this.claudeExecutablePath} --help`, { encoding: 'utf-8' });
          this.includePartialSupported = helpText.includes('--include-partial-messages');
          console.log('[ClaudeService] CLI include-partial-messages supported:', this.includePartialSupported);
        } catch (error) {
          console.warn('[ClaudeService] Failed to probe CLI --help; assuming include-partial not supported', error);
          this.includePartialSupported = false;
        }
      }

      const queryOptions: Options = {
        maxTurns: options.maxTurns || 100,
        includePartialMessages: this.includePartialSupported ? true : undefined,
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
        // Capture stderr from the CLI so we can see why it exited with code 1
        stderr: (data: string) => {
          try {
            const text = data.toString();
            console.error('[ClaudeService][stderr]', text);
            // Optionally, surface stderr to renderer if needed in the future
            // this.sendEvent(taskId, { type: 'system', subtype: 'stderr', message: text } as unknown as SDKMessage);
          } catch (err) {
            console.error('[ClaudeService] Failed to log stderr', err);
          }
        },
      };

      if (sessionId) {
        queryOptions.resume = sessionId;
      }

      // Provide Anthropic environment to the CLI if available
      const anthropicEnv: Record<string, string> = {};
      if (process.env.ANTHROPIC_API_KEY) {
        anthropicEnv.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      } else {
        console.warn('[ClaudeService] ANTHROPIC_API_KEY is not set in environment');
      }
      if (process.env.ANTHROPIC_BASE_URL) {
        anthropicEnv.ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL;
      }
      if (Object.keys(anthropicEnv).length > 0) {
        queryOptions.env = { ...(queryOptions.env || {}), ...anthropicEnv };
        console.log('[ClaudeService] Passing Anthropic env to CLI:', Object.keys(anthropicEnv).join(', '));
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
      console.error('[ClaudeService] Query execution error', error);
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
