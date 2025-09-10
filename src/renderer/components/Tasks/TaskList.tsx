import React, { useEffect } from 'react';
import { Plus, Hash, Archive, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/renderer/store/tasks';
import { Task } from '@/shared/types/tasks';

interface TaskListProps {
  onCreateClick: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({ onCreateClick }) => {
  const { 
    tasks, 
    activeTaskId, 
    selectTask, 
    loadTasks,
    isLoading 
  } = useTaskStore();
  
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
  const activeTasks = tasks.filter(t => t.status === 'active');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const archivedTasks = tasks.filter(t => t.status === 'archived');
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground">
          Tasks
        </h2>
        <Button
          onClick={onCreateClick}
          variant="ghost"
          size="sm"
          className="h-6 px-2"
        >
          <Plus className="h-3 w-3 mr-1" />
          New
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
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
                  className={cn(
                    "w-full justify-start text-left",
                    activeTaskId === task.id && "bg-accent"
                  )}
                  onClick={() => selectTask(task.id)}
                >
                  <span className={cn("mr-2", getTaskStatusColor(task.status))}>
                    {getTaskIcon(task.status)}
                  </span>
                  <span className="truncate flex-1">{task.name}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    {task.repositories.length}
                  </span>
                </Button>
              ))}
            </div>
          )}
          
          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <>
              <div className="text-xs font-semibold uppercase text-muted-foreground mt-4 mb-1">
                Completed
              </div>
              <div className="space-y-1">
                {completedTasks.map((task) => (
                  <Button
                    key={task.id}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start text-left opacity-60",
                      activeTaskId === task.id && "bg-accent"
                    )}
                    onClick={() => selectTask(task.id)}
                  >
                    <span className={cn("mr-2", getTaskStatusColor(task.status))}>
                      {getTaskIcon(task.status)}
                    </span>
                    <span className="truncate flex-1 line-through">{task.name}</span>
                  </Button>
                ))}
              </div>
            </>
          )}
          
          {/* No tasks message */}
          {tasks.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-2">No tasks yet</p>
              <Button
                onClick={onCreateClick}
                variant="outline"
                size="sm"
              >
                Create your first task
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};