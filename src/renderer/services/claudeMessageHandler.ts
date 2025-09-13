import { SDKMessage } from '@anthropic-ai/claude-code';

interface TaskStore {
  addMessage: (taskId: string, message: SDKMessage | string) => void;
  updateSessionId: (taskId: string, sessionId: string) => void;
  setQueryActive: (taskId: string, active: boolean) => void;
  hasActiveQuery: (taskId: string) => boolean;
}

export class ClaudeMessageHandler {
  private static instance: ClaudeMessageHandler;
  private store: TaskStore | null = null;
  private initialized = false;

  private constructor() {}

  public static getInstance(): ClaudeMessageHandler {
    if (!ClaudeMessageHandler.instance) {
      ClaudeMessageHandler.instance = new ClaudeMessageHandler();
    }
    return ClaudeMessageHandler.instance;
  }

  public initialize(store: TaskStore): void {
    if (this.initialized) {
      console.warn('ClaudeMessageHandler already initialized');
      return;
    }

    this.store = store;
    this.setupEventListeners();
    this.initialized = true;
    console.log('ClaudeMessageHandler initialized');
  }

  private setupEventListeners(): void {
    if (!this.store) return;

    // Listen for all stream events from any task
    window.electronAPI.claude.onStreamEvent((taskId: string, event: SDKMessage) => {
      if (!this.store) return;

      // Add message to the store for ANY task, not just active
      this.store.addMessage(taskId, event);

      // Track query status
      if (event.type === 'assistant') {
        // Mark query as active when assistant starts responding
        if (!this.store.hasActiveQuery(taskId)) {
          this.store.setQueryActive(taskId, true);
        }
      }

      if (event.type === 'result') {
        // Mark query as completed
        this.store.setQueryActive(taskId, false);

        // Update session ID if provided
        if (event.session_id) {
          this.store.updateSessionId(taskId, event.session_id);
        }
      }
    });

    // Listen for query status changes (for more explicit status tracking)
    if (window.electronAPI.claude.onQueryStatusChanged) {
      window.electronAPI.claude.onQueryStatusChanged((taskId: string, status: 'started' | 'completed' | 'error') => {
        if (!this.store) return;

        if (status === 'started') {
          this.store.setQueryActive(taskId, true);
        } else {
          this.store.setQueryActive(taskId, false);
        }
      });
    }
  }

  public cleanup(): void {
    window.electronAPI.claude.removeClaudeListeners();
    this.store = null;
    this.initialized = false;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}
