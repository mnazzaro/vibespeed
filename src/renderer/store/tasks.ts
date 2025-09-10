import { create } from 'zustand';
import { Task, CreateTaskParams, ChatMessage, WorktreeProgress } from '../../shared/types/tasks';

interface TaskStore {
  // State
  tasks: Task[];
  activeTaskId: string | null;
  activeTask: Task | null;
  isCreatingTask: boolean;
  selectedReposForNewTask: Array<{
    id: number;
    installationId: number;
    name: string;
    fullName: string;
    defaultBranch: string;
  }>;
  worktreeProgress: Record<string, WorktreeProgress>;
  
  // Actions
  createTask: (params: CreateTaskParams) => Promise<Task>;
  loadTasks: () => Promise<void>;
  selectTask: (taskId: string) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  sendMessage: (taskId: string, content: string) => Promise<ChatMessage>;
  
  // Task creation flow
  startTaskCreation: () => void;
  cancelTaskCreation: () => void;
  addRepoToNewTask: (repo: {
    id: number;
    installationId: number;
    name: string;
    fullName: string;
    defaultBranch: string;
  }) => void;
  removeRepoFromNewTask: (repoId: number) => void;
  clearNewTaskRepos: () => void;
  finalizeTaskCreation: () => Promise<Task | null>;
  
  // Worktree progress
  updateWorktreeProgress: (progress: WorktreeProgress) => void;
  clearWorktreeProgress: (taskId: string) => void;
  
  // Utilities
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  isLoading: boolean;
  error: string | null;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  // Initial state
  tasks: [],
  activeTaskId: null,
  activeTask: null,
  isCreatingTask: false,
  selectedReposForNewTask: [],
  worktreeProgress: {},
  isLoading: false,
  error: null,
  
  // Actions
  createTask: async (params: CreateTaskParams) => {
    set({ isLoading: true, error: null });
    
    try {
      console.log('Creating task with repos:', params.repositories.map(r => r.name));
      const response = await window.electronAPI.tasks.create(params);
      
      if (response.success && response.data) {
        const newTask = response.data;
        console.log('Task created:', newTask.id, newTask.name, 'with', newTask.repositories.length, 'repos');
        
        // Add the new task to the tasks list and set it as active
        set(state => ({
          tasks: [...state.tasks, newTask],
          activeTaskId: newTask.id,
          activeTask: newTask,
          isLoading: false
        }));
        
        // Start worktree setup
        console.log('Starting worktree setup for task:', newTask.id);
        window.electronAPI.tasks.setupWorktrees(newTask.id);
        
        return newTask;
      } else {
        throw new Error(response.error || 'Failed to create task');
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error.message || 'Failed to create task'
      });
      throw error;
    }
  },
  
  loadTasks: async () => {
    const currentState = get();
    const currentActiveId = currentState.activeTaskId;
    const currentActiveTask = currentState.activeTask;
    
    set({ isLoading: true, error: null });
    
    try {
      const response = await window.electronAPI.tasks.list();
      
      if (response.success && response.data) {
        const tasks = response.data.tasks;
        console.log('Loaded tasks:', tasks.map(t => ({ id: t.id, name: t.name, repos: t.repositories.length })));
        
        // Preserve current active task if it exists, otherwise use backend's active task
        const activeTaskId = currentActiveId || response.data.activeTaskId;
        let activeTask = tasks.find(t => t.id === activeTaskId) || null;
        
        // If we have a current active task with updated repo statuses, preserve those statuses
        if (currentActiveTask && activeTask && currentActiveTask.id === activeTask.id) {
          // Merge repository statuses from current active task
          activeTask = {
            ...activeTask,
            repositories: activeTask.repositories.map((repo, index) => {
              const currentRepo = currentActiveTask.repositories[index];
              if (currentRepo && currentRepo.id === repo.id && 
                  (currentRepo.status === 'ready' || currentRepo.status === 'error')) {
                // Preserve the updated status
                return {
                  ...repo,
                  status: currentRepo.status,
                  errorMessage: currentRepo.errorMessage
                };
              }
              return repo;
            })
          };
        }
        
        set({
          tasks: tasks.map(t => t.id === activeTaskId ? activeTask : t),
          activeTaskId,
          activeTask,
          isLoading: false
        });
      } else {
        throw new Error(response.error || 'Failed to load tasks');
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error.message || 'Failed to load tasks'
      });
    }
  },
  
  selectTask: async (taskId: string) => {
    const task = get().tasks.find(t => t.id === taskId);
    if (!task) return;
    
    set({
      activeTaskId: taskId,
      activeTask: task
    });
    
    // Notify main process
    await window.electronAPI.tasks.setActive(taskId);
  },
  
  updateTask: async (taskId: string, updates: Partial<Task>) => {
    try {
      const response = await window.electronAPI.tasks.update(taskId, updates);
      
      if (response.success && response.data) {
        set(state => ({
          tasks: state.tasks.map(t => t.id === taskId ? response.data : t),
          activeTask: state.activeTaskId === taskId ? response.data : state.activeTask
        }));
      }
    } catch (error) {
      set({
        error: error.message || 'Failed to update task'
      });
    }
  },
  
  deleteTask: async (taskId: string) => {
    try {
      const response = await window.electronAPI.tasks.delete(taskId);
      
      if (response.success) {
        set(state => {
          const newTasks = state.tasks.filter(t => t.id !== taskId);
          const wasActive = state.activeTaskId === taskId;
          const newActiveTask = wasActive ? newTasks[0] : state.activeTask;
          
          return {
            tasks: newTasks,
            activeTaskId: newActiveTask?.id || null,
            activeTask: newActiveTask || null
          };
        });
      }
    } catch (error) {
      set({
        error: error.message || 'Failed to delete task'
      });
    }
  },
  
  sendMessage: async (taskId: string, content: string) => {
    try {
      const response = await window.electronAPI.tasks.sendMessage(taskId, {
        role: 'user',
        content
      });
      
      if (response.success && response.data) {
        // Update local state with new message
        set(state => ({
          tasks: state.tasks.map(t => {
            if (t.id === taskId) {
              return {
                ...t,
                messages: [...t.messages, response.data]
              };
            }
            return t;
          }),
          activeTask: state.activeTaskId === taskId 
            ? {
                ...state.activeTask!,
                messages: [...state.activeTask!.messages, response.data]
              }
            : state.activeTask
        }));
        
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to send message');
      }
    } catch (error) {
      set({
        error: error.message || 'Failed to send message'
      });
      throw error;
    }
  },
  
  // Task creation flow
  startTaskCreation: () => {
    set({
      isCreatingTask: true,
      selectedReposForNewTask: []
    });
  },
  
  cancelTaskCreation: () => {
    set({
      isCreatingTask: false,
      selectedReposForNewTask: []
    });
  },
  
  addRepoToNewTask: (repo) => {
    set(state => ({
      selectedReposForNewTask: [...state.selectedReposForNewTask, repo]
    }));
  },
  
  removeRepoFromNewTask: (repoId: number) => {
    set(state => ({
      selectedReposForNewTask: state.selectedReposForNewTask.filter(r => r.id !== repoId)
    }));
  },
  
  clearNewTaskRepos: () => {
    set({ selectedReposForNewTask: [] });
  },
  
  finalizeTaskCreation: async () => {
    const repos = get().selectedReposForNewTask;
    if (repos.length === 0) {
      set({ isCreatingTask: false });
      return null;
    }
    
    try {
      const task = await get().createTask({ repositories: repos });
      set({
        isCreatingTask: false,
        selectedReposForNewTask: []
      });
      return task;
    } catch (error) {
      // Error is already handled in createTask
      return null;
    }
  },
  
  // Worktree progress
  updateWorktreeProgress: (progress: WorktreeProgress) => {
    console.log('Store: Worktree progress update received:', progress);
    
    set(state => ({
      worktreeProgress: {
        ...state.worktreeProgress,
        [`${progress.taskId}-${progress.repositoryId}`]: progress
      }
    }));
    
    // Always update task repository status, not just on ready/error
    const currentState = get();
    const task = currentState.tasks.find(t => t.id === progress.taskId);
    
    if (task) {
      const updatedRepos = task.repositories.map(repo => {
        if (repo.id === progress.repositoryId) {
          let newStatus: 'initializing' | 'ready' | 'error' = 'initializing';
          
          if (progress.status === 'ready') {
            newStatus = 'ready';
          } else if (progress.status === 'error') {
            newStatus = 'error';
          } else if (progress.status === 'cloning' || progress.status === 'creating_worktree') {
            newStatus = 'initializing';
          }
          
          console.log(`Store: Updating repo ${repo.name} status from ${repo.status} to ${newStatus}`);
          return {
            ...repo,
            status: newStatus,
            errorMessage: progress.status === 'error' ? progress.message : undefined
          };
        }
        return repo;
      });
      
      const updatedTask = { ...task, repositories: updatedRepos };
      
      // Update both tasks list and active task in a single set call for atomic update
      set(state => ({
        tasks: state.tasks.map(t => t.id === progress.taskId ? updatedTask : t),
        activeTask: state.activeTaskId === progress.taskId ? updatedTask : state.activeTask
      }));
      
      console.log('Store: Task updated with new repo statuses');
    }
  },
  
  clearWorktreeProgress: (taskId: string) => {
    set(state => {
      const newProgress = { ...state.worktreeProgress };
      Object.keys(newProgress).forEach(key => {
        if (key.startsWith(`${taskId}-`)) {
          delete newProgress[key];
        }
      });
      return { worktreeProgress: newProgress };
    });
  },
  
  // Utilities
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
  
  setError: (error: string | null) => {
    set({ error });
  }
}));