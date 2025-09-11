export interface ClaudeEvent {
  id: string;
  type: 'text' | 'tool_use' | 'status' | 'error' | 'stream_event';
  content?: string;
  tool?: ToolUsageInfo;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ToolUsageInfo {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
  status: 'started' | 'completed' | 'failed';
  result?: string;
  icon?: string;
}

export interface ClaudeMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  events?: ClaudeEvent[];
  isStreaming?: boolean;
  metadata?: Record<string, any>;
}

export interface ClaudeQueryOptions {
  taskId: string;
  workingDirectory: string;
  maxTurns?: number;
  allowedTools?: string[];
  appendSystemPrompt?: string;
  includePartialMessages?: boolean;
}

export interface ClaudeStreamEvent {
  type: 'partial' | 'complete' | 'tool_start' | 'tool_end' | 'error';
  content?: string;
  toolName?: string;
  toolParams?: any;
  error?: string;
  messageId: string;
}

export interface ClaudeIPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export const TOOL_ICON_MAP: Record<string, string> = {
  // File operations
  Read: 'FileText',
  Write: 'FilePlus',
  Edit: 'FileEdit',
  MultiEdit: 'FileEdit',
  NotebookEdit: 'Notebook',

  // Search and navigation
  Grep: 'Search',
  Glob: 'FolderSearch',
  WebSearch: 'Globe',
  WebFetch: 'Globe2',

  // Terminal and execution
  Bash: 'Terminal',
  BashOutput: 'Monitor',
  KillBash: 'XCircle',

  // Task management
  Task: 'ListTodo',
  TodoWrite: 'CheckSquare',
  ExitPlanMode: 'Flag',

  // Default
  default: 'Tool',
};

export interface ClaudeServiceStatus {
  isRunning: boolean;
  currentTaskId?: string;
  currentMessageId?: string;
}
