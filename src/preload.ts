// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import type { 
  AuthResponse, 
  GitHubInstallation, 
  GitHubRepository,
  AuthToken,
  UserProfile
} from './shared/types/auth';
import type {
  Task,
  CreateTaskParams,
  TaskIPCResponse,
  ChatMessage,
  WorktreeProgress
} from './shared/types/tasks';

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
  
  list: async (): Promise<TaskIPCResponse<{ tasks: Task[], activeTaskId: string | null }>> => {
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
  
  sendMessage: async (taskId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<TaskIPCResponse<ChatMessage>> => {
    return await ipcRenderer.invoke('task:sendMessage', taskId, message);
  },
  
  openInExplorer: async (taskId: string): Promise<TaskIPCResponse<void>> => {
    return await ipcRenderer.invoke('task:openInExplorer', taskId);
  },
  
  openInEditor: async (taskId: string, repositoryName: string): Promise<TaskIPCResponse<void>> => {
    return await ipcRenderer.invoke('task:openInEditor', taskId, repositoryName);
  },
  
  // Event listeners
  onWorktreeProgress: (callback: (progress: WorktreeProgress) => void) => {
    ipcRenderer.on('task:worktree-progress', (event, progress) => callback(progress));
  },
  
  onMessageReceived: (callback: (taskId: string, message: ChatMessage) => void) => {
    ipcRenderer.on('task:message-received', (event, taskId, message) => callback(taskId, message));
  },
  
  removeTaskListeners: () => {
    ipcRenderer.removeAllListeners('task:worktree-progress');
    ipcRenderer.removeAllListeners('task:message-received');
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  auth: authAPI,
  app: appAPI,
  tasks: tasksAPI,
});

// Type definitions for TypeScript
export type ElectronAPI = {
  auth: typeof authAPI;
  app: typeof appAPI;
  tasks: typeof tasksAPI;
};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
