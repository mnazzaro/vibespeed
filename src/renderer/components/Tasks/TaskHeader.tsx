import { Folder, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
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

  const handleOpenInEditor = async (repo: TaskRepository) => {
    if (repo.status === 'ready') {
      await window.electronAPI.tasks.openInEditor(task.id, repo.name);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete task "${task.name}"? This will remove all worktrees and task data.`)) {
      await deleteTask(task.id);
    }
  };

  return (
    <header className="bg-card flex h-14 items-center gap-3 border-b px-6">
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
            <h2 className="hover:text-primary cursor-pointer" onClick={() => setEditingName(true)}>
              {task.name}
            </h2>
          </>
        )}
      </div>

      {/* Actions */}
      {task.repositories.length > 0 &&
        task.repositories.map((repo) => (
          <>
            <Button variant="ghost" size="sm" onClick={() => handleOpenInEditor(repo)}>
              <Folder className="mr-2 h-4 w-4" />
              Open {repo.name}
            </Button>
          </>
        ))}

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
