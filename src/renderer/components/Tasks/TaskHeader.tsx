import { GitBranch, Folder, Code, Check, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/renderer/store/tasks';
import { Task, TaskRepository } from '@/shared/types/tasks';

interface TaskHeaderProps {
  task: Task;
}

export const TaskHeader: React.FC<TaskHeaderProps> = ({ task }) => {
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(task.name);
  const { updateTask, deleteTask } = useTaskStore();

  const handleNameSave = async () => {
    if (newName && newName !== task.name) {
      await updateTask(task.id, { name: newName });
    }
    setEditingName(false);
  };

  const getRepoStatusIcon = (status: TaskRepository['status']) => {
    switch (status) {
      case 'initializing':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'ready':
        return <Check className="h-3 w-3 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-600" />;
      default:
        return <GitBranch className="h-3 w-3" />;
    }
  };

  const getRepoStatusColor = (status: TaskRepository['status']) => {
    switch (status) {
      case 'ready':
        return 'border-green-600/50 bg-green-600/10';
      case 'error':
        return 'border-red-600/50 bg-red-600/10';
      case 'initializing':
        return 'border-primary/50 bg-primary/10';
      default:
        return 'border-border';
    }
  };

  const handleOpenInEditor = async (repo: TaskRepository) => {
    if (repo.status === 'ready') {
      await window.electronAPI.tasks.openInEditor(task.id, repo.name);
    }
  };

  const handleOpenInExplorer = async () => {
    await window.electronAPI.tasks.openInExplorer(task.id);
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete task "${task.name}"? This will remove all worktrees and task data.`)) {
      await deleteTask(task.id);
    }
  };

  return (
    <header className="bg-card flex flex-col gap-3 border-b px-6 py-4">
      {/* Task name */}
      <div className="flex items-center gap-3">
        {editingName ? (
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSave();
              if (e.key === 'Escape') {
                setNewName(task.name);
                setEditingName(false);
              }
            }}
            className="border-primary flex-1 border-b bg-transparent text-lg font-semibold outline-none"
            autoFocus
          />
        ) : (
          <h2
            className="hover:text-primary flex-1 cursor-pointer text-lg font-semibold"
            onClick={() => setEditingName(true)}
          >
            {task.name}
          </h2>
        )}

        <Button variant="ghost" size="sm" onClick={handleOpenInExplorer}>
          <Folder className="mr-2 h-4 w-4" />
          Open Folder
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Task
        </Button>
      </div>

      {/* Repository badges */}
      <div className="flex flex-wrap gap-2">
        {task.repositories.map((repo) => (
          <div
            key={repo.id}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
              getRepoStatusColor(repo.status)
            )}
          >
            {getRepoStatusIcon(repo.status)}
            <span className="font-medium">{repo.name}</span>
            <span className="text-muted-foreground text-xs">{repo.taskBranch}</span>

            {repo.status === 'ready' && (
              <button
                onClick={() => handleOpenInEditor(repo)}
                className="hover:text-primary ml-1"
                title="Open in VS Code"
              >
                <Code className="h-3 w-3" />
              </button>
            )}

            {repo.status === 'error' && repo.errorMessage && (
              <span className="text-xs text-red-600" title={repo.errorMessage}>
                !
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Status line */}
      <div className="text-muted-foreground flex items-center gap-4 text-xs">
        <span>Created {new Date(task.createdAt).toLocaleDateString()}</span>
        <span>•</span>
        <span>{task.messages.length} messages</span>
        <span>•</span>
        <span
          className={cn(
            'capitalize',
            task.status === 'active' && 'text-green-600',
            task.status === 'completed' && 'text-blue-600',
            task.status === 'archived' && 'text-gray-600'
          )}
        >
          {task.status}
        </span>
      </div>
    </header>
  );
};
