export interface ToolUsageInfo {
  id?: string; // Tool use ID for matching with results
  name: string;
  description?: string;
  parameters?: Record<string, any>;
  status: 'started' | 'completed' | 'failed';
  result?: string;
  icon?: string;
}

export interface ClaudeQueryOptions {
  taskId: string;
  workingDirectory: string;
  maxTurns?: number;
  allowedTools?: string[];
  appendSystemPrompt?: string;
  includePartialMessages?: boolean;
  maxTokens?: number;
  temperature?: number;
  model?: 'claude-opus-4-1-20250805' | 'claude-sonnet-4-20250514';
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
