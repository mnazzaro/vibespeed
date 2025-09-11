import { GitBranch, Folder, Code, AlertCircle, Loader2, Trash2 } from 'lucide-react';
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
        return <Loader2 className="h-2.5 w-2.5 animate-spin" />;
      case 'ready':
        return <Code className="h-2.5 w-2.5 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-2.5 w-2.5 text-red-600" />;
      default:
        return <GitBranch className="h-2.5 w-2.5" />;
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
    <header className="bg-card flex items-start gap-3 px-6 py-3">
      <div className="flex flex-1 flex-col gap-1">
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
            className="border-primary border-b bg-transparent text-base font-semibold outline-none"
            autoFocus
          />
        ) : (
          <>
            <h2
              className="hover:text-primary cursor-pointer text-base font-semibold"
              onClick={() => setEditingName(true)}
            >
              {task.name}
            </h2>
          </>
        )}

        {/* Repository pills */}
        <div className="mt-1 flex gap-1.5">
          {task.repositories.map((repo) => (
            <button
              key={repo.id}
              onClick={() => handleOpenInEditor(repo)}
              disabled={repo.status !== 'ready'}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                getRepoStatusColor(repo.status),
                repo.status === 'ready' && 'hover:bg-accent cursor-pointer'
              )}
              title={repo.status === 'ready' ? 'Open in VS Code' : repo.errorMessage || repo.status}
            >
              {getRepoStatusIcon(repo.status)}
              <span className="font-medium">{repo.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
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
        Delete
      </Button>
    </header>
  );
};
