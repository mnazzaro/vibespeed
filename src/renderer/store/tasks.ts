import { SDKMessage } from '@anthropic-ai/claude-code';
import { create } from 'zustand';

import { Task, CreateTaskParams, WorktreeProgress } from '../../shared/types/tasks';

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
  activeQueries: Set<string>; // Track which tasks have running queries
  // Actions
  createTask: (params: CreateTaskParams) => Promise<Task>;
  loadTasks: () => Promise<void>;
  selectTask: (taskId: string) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;

  // Message actions
  addMessage: (taskId: string, message: SDKMessage | string) => void;
  updateSessionId: (taskId: string, sessionId: string) => void;

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

  // Query tracking
  hasActiveQuery: (taskId: string) => boolean;
  setQueryActive: (taskId: string, active: boolean) => void;
  getActiveQueries: () => Set<string>;

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
  activeQueries: new Set<string>(),
  isLoading: false,
  error: null,

  // Actions
  createTask: async (params: CreateTaskParams) => {
    set({ isLoading: true, error: null });

    try {
      console.log(
        'Creating task with repos:',
        params.repositories.map((r) => r.name)
      );
      const response = await window.electronAPI.tasks.create(params);

      if (response.success && response.data) {
        const newTask = response.data;
        console.log('Task created:', newTask.id, newTask.name, 'with', newTask.repositories.length, 'repos');

        // Add the new task to the tasks list and set it as active
        set((state) => ({
          tasks: [...state.tasks, newTask],
          activeTaskId: newTask.id,
          activeTask: newTask,
          isLoading: false,
        }));

        // Start worktree setup after a small delay to ensure listeners are registered
        console.log('Starting worktree setup for task:', newTask.id);
        setTimeout(() => {
          window.electronAPI.tasks.setupWorktrees(newTask.id);
        }, 100);

        return newTask;
      } else {
        throw new Error(response.error || 'Failed to create task');
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error.message || 'Failed to create task',
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
        console.log(
          'Loaded tasks:',
          tasks.map((t) => ({ id: t.id, name: t.name, repos: t.repositories.length }))
        );

        // Preserve current active task if it exists, otherwise use backend's active task
        const activeTaskId = currentActiveId || response.data.activeTaskId;
        let activeTask = tasks.find((t) => t.id === activeTaskId) || null;

        // If we have a current active task with updated repo statuses, preserve those statuses
        if (currentActiveTask && activeTask && currentActiveTask.id === activeTask.id) {
          // Merge repository statuses from current active task
          activeTask = {
            ...activeTask,
            repositories: activeTask.repositories.map((repo, index) => {
              const currentRepo = currentActiveTask.repositories[index];
              if (
                currentRepo &&
                currentRepo.id === repo.id &&
                (currentRepo.status === 'ready' || currentRepo.status === 'error')
              ) {
                // Preserve the updated status
                return {
                  ...repo,
                  status: currentRepo.status,
                  errorMessage: currentRepo.errorMessage,
                };
              }
              return repo;
            }),
          };
        }

        set({
          tasks: tasks.map((t) => (t.id === activeTaskId ? activeTask : t)),
          activeTaskId,
          activeTask,
          isLoading: false,
        });
      } else {
        throw new Error(response.error || 'Failed to load tasks');
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error.message || 'Failed to load tasks',
      });
    }
  },

  selectTask: async (taskId: string) => {
    // First try to get the task from the backend to ensure we have the latest data
    try {
      const response = await window.electronAPI.tasks.get(taskId);
      if (response.success && response.data) {
        const freshTask = response.data;

        // Update the task in our store with the fresh data
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === taskId ? freshTask : t)),
          activeTaskId: taskId,
          activeTask: freshTask,
        }));

        // Notify main process
        await window.electronAPI.tasks.setActive(taskId);
        return;
      }
    } catch (error) {
      console.error('Failed to get fresh task data:', error);
    }

    // Fallback to local data if backend fetch fails
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    set({
      activeTaskId: taskId,
      activeTask: task,
    });

    // Notify main process
    await window.electronAPI.tasks.setActive(taskId);
  },

  updateTask: async (taskId: string, updates: Partial<Task>) => {
    try {
      const response = await window.electronAPI.tasks.update(taskId, updates);

      if (response.success && response.data) {
        set((state) => {
          // Get the current task to check if we need to preserve local data
          const currentTask = state.tasks.find((t) => t.id === taskId);
          let updatedTask = response.data;

          // If we have local messages that the backend doesn't have yet, preserve them
          // This can happen when we've committed streaming messages but the backend hasn't processed them yet
          if (currentTask && currentTask.messages && updatedTask.messages) {
            // Check if our local messages include everything from backend plus more
            const backendMessageCount = updatedTask.messages.filter((m: any) => typeof m !== 'string').length;
            const localMessageCount = currentTask.messages.filter((m: any) => typeof m !== 'string').length;

            if (localMessageCount > backendMessageCount) {
              // Keep our local messages as they're more complete
              updatedTask = {
                ...updatedTask,
                messages: currentTask.messages,
              };
            }
          }

          return {
            tasks: state.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
            activeTask: state.activeTaskId === taskId ? updatedTask : state.activeTask,
          };
        });
      }
    } catch (error) {
      set({
        error: error.message || 'Failed to update task',
      });
    }
  },

  deleteTask: async (taskId: string) => {
    try {
      const response = await window.electronAPI.tasks.delete(taskId);

      if (response.success) {
        set((state) => {
          const newTasks = state.tasks.filter((t) => t.id !== taskId);
          const wasActive = state.activeTaskId === taskId;
          const newActiveTask = wasActive ? newTasks[0] : state.activeTask;

          return {
            tasks: newTasks,
            activeTaskId: newActiveTask?.id || null,
            activeTask: newActiveTask || null,
          };
        });
      }
    } catch (error) {
      set({
        error: error.message || 'Failed to delete task',
      });
    }
  },

  // Message actions
  addMessage: (taskId: string, message: SDKMessage | string) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Add the message to the task's messages array
    const updatedTask = {
      ...task,
      messages: [...task.messages, message],
    };

    // Update local state immediately - optimize by only updating if task exists
    set((state) => {
      // Only map through tasks if we need to update
      const taskIndex = state.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) return state;

      const newTasks = [...state.tasks];
      newTasks[taskIndex] = updatedTask;

      return {
        tasks: newTasks,
        activeTask: state.activeTaskId === taskId ? updatedTask : state.activeTask,
      };
    });

    // Persist to backend asynchronously (fire and forget)
    window.electronAPI.tasks
      .update(taskId, {
        messages: updatedTask.messages,
      })
      .catch((error) => {
        console.error('Failed to persist message to backend:', error);
      });
  },

  updateSessionId: (taskId: string, sessionId: string) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Update the session ID
    const updatedTask = {
      ...task,
      sessionId,
    };

    // Update local state immediately
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
      activeTask: state.activeTaskId === taskId ? updatedTask : state.activeTask,
    }));

    // Persist to backend asynchronously (fire and forget)
    window.electronAPI.tasks
      .update(taskId, {
        sessionId,
      })
      .catch((error) => {
        console.error('Failed to persist sessionId to backend:', error);
      });
  },

  // Task creation flow
  startTaskCreation: () => {
    set({
      isCreatingTask: true,
      selectedReposForNewTask: [],
    });
  },

  cancelTaskCreation: () => {
    set({
      isCreatingTask: false,
      selectedReposForNewTask: [],
    });
  },

  addRepoToNewTask: (repo) => {
    set((state) => ({
      selectedReposForNewTask: [...state.selectedReposForNewTask, repo],
    }));
  },

  removeRepoFromNewTask: (repoId: number) => {
    set((state) => ({
      selectedReposForNewTask: state.selectedReposForNewTask.filter((r) => r.id !== repoId),
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
        selectedReposForNewTask: [],
      });
      return task;
    } catch {
      return null;
    }
  },

  // Worktree progress
  updateWorktreeProgress: (progress: WorktreeProgress) => {
    console.log('Store: Worktree progress update received:', progress);

    set((state) => ({
      worktreeProgress: {
        ...state.worktreeProgress,
        [`${progress.taskId}-${progress.repositoryId}`]: progress,
      },
    }));

    // Always update task repository status
    set((state) => {
      const task = state.tasks.find((t) => t.id === progress.taskId);

      if (!task) {
        console.log(`Store: Task ${progress.taskId} not found`);
        return state;
      }

      const updatedRepos = task.repositories.map((repo) => {
        if (repo.id === progress.repositoryId) {
          let newStatus: 'initializing' | 'ready' | 'error' = repo.status;

          // Map progress status to repository status
          if (progress.status === 'ready') {
            newStatus = 'ready';
          } else if (progress.status === 'error') {
            newStatus = 'error';
          } else if (
            progress.status === 'cloning' ||
            progress.status === 'creating-worktree' ||
            progress.status === 'checking-out'
          ) {
            newStatus = 'initializing';
          }

          console.log(`Store: Updating repo ${repo.name} status from ${repo.status} to ${newStatus}`);
          return {
            ...repo,
            status: newStatus,
            errorMessage: progress.status === 'error' ? progress.message : undefined,
          };
        }
        return repo;
      });

      const updatedTask = { ...task, repositories: updatedRepos };

      // Return updated state with both tasks list and active task updated
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === progress.taskId ? updatedTask : t)),
        activeTask: state.activeTaskId === progress.taskId ? updatedTask : state.activeTask,
      };
    });

    console.log('Store: Task updated with new repo statuses');
  },

  clearWorktreeProgress: (taskId: string) => {
    set((state) => {
      const newProgress = { ...state.worktreeProgress };
      Object.keys(newProgress).forEach((key) => {
        if (key.startsWith(`${taskId}-`)) {
          delete newProgress[key];
        }
      });
      return { worktreeProgress: newProgress };
    });
  },

  // Query tracking
  hasActiveQuery: (taskId: string) => {
    return get().activeQueries.has(taskId);
  },

  setQueryActive: (taskId: string, active: boolean) => {
    set((state) => {
      const hasQuery = state.activeQueries.has(taskId);

      // Only update if the state actually changes
      if (active && !hasQuery) {
        const newActiveQueries = new Set(state.activeQueries);
        newActiveQueries.add(taskId);
        return { activeQueries: newActiveQueries };
      } else if (!active && hasQuery) {
        const newActiveQueries = new Set(state.activeQueries);
        newActiveQueries.delete(taskId);
        return { activeQueries: newActiveQueries };
      }

      // No change needed - return the same state
      return state;
    });
  },

  getActiveQueries: () => {
    return get().activeQueries;
  },

  // Utilities
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
