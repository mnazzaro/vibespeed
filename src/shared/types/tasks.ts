import { SDKMessage } from '@anthropic-ai/claude-code';

export interface Task {
  id: string;
  name: string;
  repositories: TaskRepository[];
  worktreeBasePath: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  messages: (SDKMessage | string)[];
  sessionId?: string; // Claude conversation session ID for maintaining context
}

export interface TaskRepository {
  id: number;
  installationId: number;
  name: string;
  fullName: string;
  originalBranch: string;
  taskBranch: string;
  worktreePath: string;
  status: 'initializing' | 'ready' | 'error';
  errorMessage?: string;
}

export interface CreateTaskParams {
  repositories: Array<{
    id: number;
    installationId: number;
    name: string;
    fullName: string;
    defaultBranch: string;
  }>;
}

export interface TaskStoreData {
  tasks: Task[];
  activeTaskId: string | null;
  lastUpdated: number;
}

export interface TaskIPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface WorktreeProgress {
  taskId: string;
  repositoryId: number;
  status: 'cloning' | 'creating-worktree' | 'checking-out' | 'ready' | 'error';
  progress?: number;
  message?: string;
}
