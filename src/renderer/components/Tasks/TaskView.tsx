import React, { useEffect } from 'react';
import { TaskHeader } from './TaskHeader';
import { TaskChat } from './TaskChat';
import { Task, WorktreeProgress } from '@/shared/types/tasks';
import { useTaskStore } from '@/renderer/store/tasks';
import { Loader2 } from 'lucide-react';

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
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-muted-foreground">No task selected</p>
      </div>
    );
  }
  
  // Check if any repos are still initializing
  const isInitializing = task.repositories.some(r => r.status === 'initializing');
  
  console.log('TaskView render - Task:', task.id, 'Repos:', task.repositories.map(r => ({
    name: r.name,
    status: r.status
  })));
  
  return (
    <div className="flex flex-col h-full">
      <TaskHeader task={task} />
      
      {isInitializing ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <h3 className="text-lg font-medium mb-2">Setting up repositories</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Creating git worktrees for your selected repositories. This may take a moment...
          </p>
          
          <div className="mt-6 space-y-2 w-full max-w-md">
            {task.repositories.map(repo => (
              <div key={repo.id} className="flex items-center gap-3 text-sm">
                <div className="flex-shrink-0">
                  {repo.status === 'ready' ? (
                    <div className="h-4 w-4 rounded-full bg-green-600" />
                  ) : repo.status === 'error' ? (
                    <div className="h-4 w-4 rounded-full bg-red-600" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                </div>
                <span className="flex-1">{repo.name}</span>
                <span className="text-xs text-muted-foreground">
                  {repo.status === 'ready' ? 'Ready' : 
                   repo.status === 'error' ? 'Error' : 
                   'Setting up...'}
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