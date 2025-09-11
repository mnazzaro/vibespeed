import { Loader2 } from 'lucide-react';
import React, { useEffect } from 'react';

import { useTaskStore } from '@/renderer/store/tasks';
import { Task, WorktreeProgress } from '@/shared/types/tasks';

import { TaskChat } from './TaskChat';
import { TaskHeader } from './TaskHeader';

interface TaskViewProps {
  task: Task;
}

export const TaskView: React.FC<TaskViewProps> = ({ task: propTask }) => {
  // Subscribe to activeTask from the store to get real-time updates
  const { activeTask, updateWorktreeProgress, clearWorktreeProgress } = useTaskStore();

  // Use activeTask from store if available, otherwise fall back to prop
  const task = activeTask || propTask;

  // Listen for worktree progress updates
  useEffect(() => {
    const handleProgress = (progress: WorktreeProgress) => {
      console.log('TaskView received worktree progress:', progress);
      updateWorktreeProgress(progress);
    };

    window.electronAPI.tasks.onWorktreeProgress(handleProgress);

    return () => {
      window.electronAPI.tasks.removeTaskListeners();
    };
  }, [updateWorktreeProgress]);

  // Clear progress when task changes
  useEffect(() => {
    if (task?.id) {
      return () => {
        clearWorktreeProgress(task.id);
      };
    }
  }, [task?.id, clearWorktreeProgress]);

  // Safety check
  if (!task) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-muted-foreground">No task selected</p>
      </div>
    );
  }

  // Check if any repos are still initializing
  const isInitializing = task.repositories.some((r) => r.status === 'initializing');

  console.log(
    'TaskView render - Task:',
    task.id,
    'Repos:',
    task.repositories.map((r) => ({
      name: r.name,
      status: r.status,
    }))
  );

  return (
    <div className="flex h-full flex-col">
      <TaskHeader task={task} />

      {isInitializing ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <Loader2 className="text-primary mb-4 h-8 w-8 animate-spin" />
          <h3 className="mb-2 text-lg font-medium">Setting up repositories</h3>
          <p className="text-muted-foreground max-w-md text-center text-sm">
            Creating git worktrees for your selected repositories. This may take a moment...
          </p>

          <div className="mt-6 w-full max-w-md space-y-2">
            {task.repositories.map((repo) => (
              <div key={repo.id} className="flex items-center gap-3 text-sm">
                <div className="flex-shrink-0">
                  {repo.status === 'ready' ? (
                    <div className="h-4 w-4 rounded-full bg-green-600" />
                  ) : repo.status === 'error' ? (
                    <div className="h-4 w-4 rounded-full bg-red-600" />
                  ) : (
                    <Loader2 className="text-primary h-4 w-4 animate-spin" />
                  )}
                </div>
                <span className="flex-1">{repo.name}</span>
                <span className="text-muted-foreground text-xs">
                  {repo.status === 'ready' ? 'Ready' : repo.status === 'error' ? 'Error' : 'Setting up...'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <TaskChat task={task} />
      )}
    </div>
  );
};
