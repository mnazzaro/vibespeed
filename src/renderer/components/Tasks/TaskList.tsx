import { Plus, Hash, Archive, Check, Loader2 } from 'lucide-react';
import React, { useEffect, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/renderer/store/tasks';
import { Task } from '@/shared/types/tasks';

interface TaskListProps {
  onCreateClick: () => void;
}

// Component for individual task item to optimize re-renders
const TaskItem: React.FC<{
  task: Task;
  isActive: boolean;
  onSelect: () => void;
}> = ({ task, isActive, onSelect }) => {
  // Only this component re-renders when its specific query status changes
  const hasActiveQuery = useTaskStore((state) => state.activeQueries.has(task.id));

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

  const isCompleted = task.status === 'completed';

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('w-full justify-start text-left', isActive && 'bg-accent', isCompleted && 'opacity-60')}
      onClick={onSelect}
    >
      <span className={cn('mr-2', getTaskStatusColor(task.status))}>{getTaskIcon(task.status)}</span>
      <span className={cn('flex-1 truncate', isCompleted && 'line-through')}>{task.name}</span>
      {hasActiveQuery && <Loader2 className="text-primary mr-1 h-3 w-3 animate-spin" />}
      {task.status === 'active' && (
        <span className="text-muted-foreground ml-1 text-xs">{task.repositories.length}</span>
      )}
    </Button>
  );
};

export const TaskList: React.FC<TaskListProps> = ({ onCreateClick }) => {
  const { tasks, activeTaskId, selectTask, loadTasks, isLoading } = useTaskStore();

  useEffect(() => {
    loadTasks();
  }, []);

  // Group tasks by status - memoize to avoid recalculation
  const { activeTasks, completedTasks } = useMemo(
    () => ({
      activeTasks: tasks.filter((t) => t.status === 'active'),
      completedTasks: tasks.filter((t) => t.status === 'completed'),
    }),
    [tasks]
  );

  return (
    <div className="space-y-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-muted-foreground font-mono text-xs">Tasks</h2>
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
                <TaskItem
                  key={task.id}
                  task={task}
                  isActive={activeTaskId === task.id}
                  onSelect={() => selectTask(task.id)}
                />
              ))}
            </div>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <>
              <div className="text-muted-foreground mt-4 mb-1 text-xs font-semibold uppercase">Completed</div>
              <div className="space-y-1">
                {completedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    isActive={activeTaskId === task.id}
                    onSelect={() => selectTask(task.id)}
                  />
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
