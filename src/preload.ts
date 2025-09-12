// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

import type { AuthResponse, GitHubInstallation, GitHubRepository, AuthToken, UserProfile } from './shared/types/auth';
import type { ClaudeIPCResponse, ClaudeServiceStatus } from './shared/types/claude';
import type { Task, CreateTaskParams, TaskIPCResponse, WorktreeProgress } from './shared/types/tasks';
import { Options, SDKMessage } from '@anthropic-ai/claude-code';

// Define the API that will be exposed to the renderer
const authAPI = {
  // Start OAuth flow
  startFlow: async (): Promise<{ success: boolean; authUrl?: string; state?: string; error?: string }> => {
    return await ipcRenderer.invoke('auth:start-flow');
  },

  // Handle OAuth callback
  handleCallback: async (code: string, state: string): Promise<AuthResponse> => {
    return await ipcRenderer.invoke('auth:handle-callback', code, state);
  },

  // Get installations
  getInstallations: async (): Promise<GitHubInstallation[]> => {
    return await ipcRenderer.invoke('auth:get-installations');
  },

  // Select installation
  selectInstallation: async (installationId: number): Promise<AuthResponse> => {
    return await ipcRenderer.invoke('auth:select-installation', installationId);
  },

  // Get current token
  getCurrentToken: async (): Promise<AuthToken | null> => {
    return await ipcRenderer.invoke('auth:get-current-token');
  },

  // Refresh authentication
  refreshToken: async (): Promise<AuthResponse> => {
    return await ipcRenderer.invoke('auth:refresh-token');
  },

  // Logout
  logout: async (): Promise<void> => {
    return await ipcRenderer.invoke('auth:logout');
  },

  // Get current user
  getUser: async (): Promise<UserProfile | null> => {
    return await ipcRenderer.invoke('auth:get-user');
  },

  // Get repositories
  getRepositories: async (installationId: number): Promise<GitHubRepository[]> => {
    return await ipcRenderer.invoke('auth:get-repositories', installationId);
  },

  // Check if authenticated
  isAuthenticated: async (): Promise<boolean> => {
    return await ipcRenderer.invoke('auth:is-authenticated');
  },

  // Get complete auth state
  getState: async () => {
    return await ipcRenderer.invoke('auth:get-state');
  },

  // Event listeners
  onStateChanged: (callback: (data: any) => void) => {
    ipcRenderer.on('auth:state-changed', (event, data) => callback(data));
  },

  onCallbackReceived: (callback: (response: AuthResponse) => void) => {
    ipcRenderer.on('auth:callback-received', (event, response) => callback(response));
  },

  onInstallationSelected: (callback: (data: any) => void) => {
    ipcRenderer.on('auth:installation-selected', (event, data) => callback(data));
  },

  onInitialState: (callback: (state: any) => void) => {
    ipcRenderer.on('auth:initial-state', (event, state) => callback(state));
  },

  // Remove listeners
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('auth:state-changed');
    ipcRenderer.removeAllListeners('auth:callback-received');
    ipcRenderer.removeAllListeners('auth:installation-selected');
    ipcRenderer.removeAllListeners('auth:initial-state');
  },
};

// Define general app API
const appAPI = {
  openExternal: async (url: string): Promise<void> => {
    return await ipcRenderer.invoke('app:open-external', url);
  },
  getInstallationUrl: async (): Promise<string> => {
    return await ipcRenderer.invoke('app:get-installation-url');
  },
};

// Define task API
const tasksAPI = {
  create: async (params: CreateTaskParams): Promise<TaskIPCResponse<Task>> => {
    return await ipcRenderer.invoke('task:create', params);
  },

  list: async (): Promise<TaskIPCResponse<{ tasks: Task[]; activeTaskId: string | null }>> => {
    return await ipcRenderer.invoke('task:list');
  },

  get: async (taskId: string): Promise<TaskIPCResponse<Task>> => {
    return await ipcRenderer.invoke('task:get', taskId);
  },

  update: async (taskId: string, updates: Partial<Task>): Promise<TaskIPCResponse<Task>> => {
    return await ipcRenderer.invoke('task:update', taskId, updates);
  },

  delete: async (taskId: string): Promise<TaskIPCResponse<void>> => {
    return await ipcRenderer.invoke('task:delete', taskId);
  },

  setActive: async (taskId: string): Promise<TaskIPCResponse<void>> => {
    return await ipcRenderer.invoke('task:setActive', taskId);
  },

  setupWorktrees: async (taskId: string): Promise<TaskIPCResponse<void>> => {
    return await ipcRenderer.invoke('task:setupWorktrees', taskId);
  },

  sendMessage: async (taskId: string, message: SDKMessage): Promise<TaskIPCResponse<SDKMessage>> => {
    return await ipcRenderer.invoke('task:sendMessage', taskId, message);
  },

  openInExplorer: async (taskId: string): Promise<TaskIPCResponse<void>> => {
    return await ipcRenderer.invoke('task:openInExplorer', taskId);
  },

  openInEditor: async (taskId: string, repositoryName: string): Promise<TaskIPCResponse<void>> => {
    return await ipcRenderer.invoke('task:openInEditor', taskId, repositoryName);
  },

  getGitStatus: async (taskId: string): Promise<TaskIPCResponse<any>> => {
    return await ipcRenderer.invoke('task:getGitStatus', taskId);
  },

  getGitDiff: async (taskId: string, repoName: string): Promise<TaskIPCResponse<any>> => {
    return await ipcRenderer.invoke('task:getGitDiff', taskId, repoName);
  },

  stageFiles: async (
    taskId: string,
    repoName: string,
    files: string[],
    stage: boolean
  ): Promise<TaskIPCResponse<void>> => {
    return await ipcRenderer.invoke('task:stageFiles', taskId, repoName, files, stage);
  },

  getFileDiff: async (taskId: string, repoName: string, filePath: string): Promise<TaskIPCResponse<string>> => {
    return await ipcRenderer.invoke('task:getFileDiff', taskId, repoName, filePath);
  },

  getFileContext: async (
    taskId: string,
    repoName: string,
    filePath: string,
    startLine: number,
    endLine: number
  ): Promise<TaskIPCResponse<string[]>> => {
    return await ipcRenderer.invoke('task:getFileContext', taskId, repoName, filePath, startLine, endLine);
  },

  getFullFileDiff: async (
    taskId: string,
    repoName: string,
    filePath: string,
    context?: number
  ): Promise<TaskIPCResponse<string>> => {
    return await ipcRenderer.invoke('task:getFullFileDiff', taskId, repoName, filePath, context);
  },

  commit: async (taskId: string, repoName: string, message: string): Promise<TaskIPCResponse<void>> => {
    return await ipcRenderer.invoke('task:commit', taskId, repoName, message);
  },

  // Event listeners
  onWorktreeProgress: (callback: (progress: WorktreeProgress) => void) => {
    ipcRenderer.on('task:worktree-progress', (event, progress) => callback(progress));
  },

  onMessageReceived: (callback: (taskId: string, message: SDKMessage) => void) => {
    ipcRenderer.on('task:message-received', (event, taskId, message) => callback(taskId, message));
  },

  onTaskUpdated: (callback: (taskId: string, task: Task) => void) => {
    ipcRenderer.on('task:updated', (event, taskId, task) => callback(taskId, task));
  },

  removeTaskListeners: () => {
    ipcRenderer.removeAllListeners('task:worktree-progress');
    ipcRenderer.removeAllListeners('task:message-received');
    ipcRenderer.removeAllListeners('task:updated');
  },
};

// Define Terminal API
const terminalAPI = {
  getHomeDir: async (): Promise<string> => {
    return await ipcRenderer.invoke('terminal:getHomeDir');
  },

  create: async (cwd?: string): Promise<{ success: boolean; sessionId?: string; error?: string }> => {
    return await ipcRenderer.invoke('terminal:create', cwd);
  },

  write: async (sessionId: string, data: string): Promise<void> => {
    return await ipcRenderer.invoke('terminal:write', sessionId, data);
  },

  resize: async (sessionId: string, cols: number, rows: number): Promise<void> => {
    return await ipcRenderer.invoke('terminal:resize', sessionId, cols, rows);
  },

  kill: async (sessionId: string): Promise<void> => {
    return await ipcRenderer.invoke('terminal:kill', sessionId);
  },

  list: async (): Promise<string[]> => {
    return await ipcRenderer.invoke('terminal:list');
  },

  onData: (callback: (sessionId: string, data: string) => void) => {
    ipcRenderer.on('terminal:data', (event, sessionId, data) => callback(sessionId, data));
  },

  onExit: (callback: (sessionId: string, code: number) => void) => {
    ipcRenderer.on('terminal:exit', (event, sessionId, code) => callback(sessionId, code));
  },

  removeListeners: () => {
    ipcRenderer.removeAllListeners('terminal:data');
    ipcRenderer.removeAllListeners('terminal:exit');
  },
};

// Define Files API
const filesAPI = {
  readDirectory: async (path: string) => {
    return await ipcRenderer.invoke('files:readDirectory', path);
  },

  readFile: async (path: string): Promise<string> => {
    return await ipcRenderer.invoke('files:readFile', path);
  },

  writeFile: async (path: string, content: string): Promise<void> => {
    return await ipcRenderer.invoke('files:writeFile', path, content);
  },

  createDirectory: async (path: string): Promise<void> => {
    return await ipcRenderer.invoke('files:createDirectory', path);
  },

  delete: async (path: string): Promise<void> => {
    return await ipcRenderer.invoke('files:delete', path);
  },

  rename: async (oldPath: string, newPath: string): Promise<void> => {
    return await ipcRenderer.invoke('files:rename', oldPath, newPath);
  },

  getFileInfo: async (path: string) => {
    return await ipcRenderer.invoke('files:getFileInfo', path);
  },

  watch: async (path: string): Promise<void> => {
    return await ipcRenderer.invoke('files:watch', path);
  },

  unwatch: async (path: string): Promise<void> => {
    return await ipcRenderer.invoke('files:unwatch', path);
  },

  openInEditor: async (path: string): Promise<void> => {
    return await ipcRenderer.invoke('files:openInEditor', path);
  },

  onChanged: (callback: (path: string, event: 'add' | 'change' | 'unlink') => void) => {
    ipcRenderer.on('files:changed', (event, path, changeEvent) => callback(path, changeEvent));
  },

  removeListeners: () => {
    ipcRenderer.removeAllListeners('files:changed');
  },
};

// Define Claude API
const claudeAPI = {
  sendMessage: async (
    taskId: string,
    message: string,
    options?: Partial<Options>
  ): Promise<ClaudeIPCResponse<{ messageId: string }>> => {
    return await ipcRenderer.invoke('claude:sendMessage', taskId, message, options);
  },

  cancelQuery: async (taskId: string): Promise<ClaudeIPCResponse<boolean>> => {
    return await ipcRenderer.invoke('claude:cancelQuery', taskId);
  },

  getStatus: async (): Promise<ClaudeIPCResponse<ClaudeServiceStatus>> => {
    return await ipcRenderer.invoke('claude:getStatus');
  },

  cancelAll: async (): Promise<ClaudeIPCResponse<void>> => {
    return await ipcRenderer.invoke('claude:cancelAll');
  },

  getLogFilePath: async (): Promise<ClaudeIPCResponse<string>> => {
    return await ipcRenderer.invoke('claude:getLogFilePath');
  },

  // Event listeners
  onStreamEvent: (callback: (taskId: string, event: SDKMessage) => void) => {
    ipcRenderer.on('claude:stream-event', (event, taskId, streamEvent) => callback(taskId, streamEvent));
  },

  removeClaudeListeners: () => {
    ipcRenderer.removeAllListeners('claude:stream-event');
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  auth: authAPI,
  app: appAPI,
  tasks: tasksAPI,
  claude: claudeAPI,
  terminal: terminalAPI,
  files: filesAPI,
});

// Type definitions for TypeScript
export type ElectronAPI = {
  auth: typeof authAPI;
  app: typeof appAPI;
  tasks: typeof tasksAPI;
  claude: typeof claudeAPI;
  terminal: typeof terminalAPI;
  files: typeof filesAPI;
};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
