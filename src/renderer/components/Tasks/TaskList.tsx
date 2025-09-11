import { Plus, Hash, Archive, Check } from 'lucide-react';
import React, { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/renderer/store/tasks';
import { Task } from '@/shared/types/tasks';

interface TaskListProps {
  onCreateClick: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({ onCreateClick }) => {
  const { tasks, activeTaskId, selectTask, loadTasks, isLoading } = useTaskStore();

  useEffect(() => {
    loadTasks();
  }, []);

  const getTaskIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <Check className="h-3 w-3" />;
      case 'archived':
        return <Archive className="h-3 w-3" />;
      default:
        return <Hash className="h-3 w-3" />;
    }
  };

  const getTaskStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'archived':
        return 'text-muted-foreground';
      default:
        return 'text-primary';
    }
  };

  // Group tasks by status
  const activeTasks = tasks.filter((t) => t.status === 'active');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase">Tasks</h2>
        <Button onClick={onCreateClick} variant="ghost" size="sm" className="h-6 px-2">
          <Plus className="mr-1 h-3 w-3" />
          New
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></div>
        </div>
      ) : (
        <>
          {/* Active Tasks */}
          {activeTasks.length > 0 && (
            <div className="space-y-1">
              {activeTasks.map((task) => (
                <Button
                  key={task.id}
                  variant="ghost"
                  size="sm"
                  className={cn('w-full justify-start text-left', activeTaskId === task.id && 'bg-accent')}
                  onClick={() => selectTask(task.id)}
                >
                  <span className={cn('mr-2', getTaskStatusColor(task.status))}>{getTaskIcon(task.status)}</span>
                  <span className="flex-1 truncate">{task.name}</span>
                  <span className="text-muted-foreground ml-1 text-xs">{task.repositories.length}</span>
                </Button>
              ))}
            </div>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <>
              <div className="text-muted-foreground mt-4 mb-1 text-xs font-semibold uppercase">Completed</div>
              <div className="space-y-1">
                {completedTasks.map((task) => (
                  <Button
                    key={task.id}
                    variant="ghost"
                    size="sm"
                    className={cn('w-full justify-start text-left opacity-60', activeTaskId === task.id && 'bg-accent')}
                    onClick={() => selectTask(task.id)}
                  >
                    <span className={cn('mr-2', getTaskStatusColor(task.status))}>{getTaskIcon(task.status)}</span>
                    <span className="flex-1 truncate line-through">{task.name}</span>
                  </Button>
                ))}
              </div>
            </>
          )}

          {/* No tasks message */}
          {tasks.length === 0 && (
            <div className="py-4 text-center">
              <p className="text-muted-foreground mb-2 text-sm">No tasks yet</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
