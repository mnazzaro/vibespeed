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
        error: error.message || 'Failed to create task',
      });
      throw error;
    }
  },

  loadTasks: async () => {
    const currentState = get();
    const currentActiveId = currentState.activeTaskId;

    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.tasks.list();

      if (response.success && response.data) {
        const tasks = response.data.tasks;
        console.log(
          'Loaded tasks:',
          tasks.map((t) => ({ id: t.id, name: t.name, repos: t.repositories.length }))
        );

        // Use backend's active task or preserve current selection
        const activeTaskId = currentActiveId || response.data.activeTaskId;
        const activeTask = tasks.find((t) => t.id === activeTaskId) || null;

        // Trust backend data as source of truth - no status preservation
        // Worktree progress events will update statuses in real-time

        set({
          tasks,
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

    // Update local state immediately
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
      activeTask: state.activeTaskId === taskId ? updatedTask : state.activeTask,
    }));

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

    // Always update task repository status, not just on ready/error
    const currentState = get();
    const task = currentState.tasks.find((t) => t.id === progress.taskId);

    if (task) {
      const updatedRepos = task.repositories.map((repo) => {
        if (repo.id === progress.repositoryId) {
          let newStatus: 'initializing' | 'ready' | 'error' = 'initializing';

          if (progress.status === 'ready') {
            newStatus = 'ready';
          } else if (progress.status === 'error') {
            newStatus = 'error';
          } else if (progress.status === 'cloning' || progress.status === 'creating-worktree') {
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

      // Update both tasks list and active task in a single set call for atomic update
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === progress.taskId ? updatedTask : t)),
        activeTask: state.activeTaskId === progress.taskId ? updatedTask : state.activeTask,
      }));

      console.log('Store: Task updated with new repo statuses');
    }
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

  // Utilities
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
