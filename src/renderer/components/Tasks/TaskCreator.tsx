import { X, Search } from 'lucide-react';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/renderer/store/auth';
import { useTaskStore } from '@/renderer/store/tasks';

interface TaskCreatorProps {
  onCancel: () => void;
  onComplete: () => void;
}

export const TaskCreator: React.FC<TaskCreatorProps> = ({ onCancel, onComplete }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [allRepos, setAllRepos] = useState<
    Array<{
      id: number;
      installationId: number;
      name: string;
      fullName: string;
      defaultBranch: string;
      installation: string;
    }>
  >([]);

  const { selectedReposForNewTask, addRepoToNewTask, removeRepoFromNewTask, finalizeTaskCreation } = useTaskStore();

  const { installations, loadRepositories } = useAuthStore();

  // Load all repositories from all installations
  useEffect(() => {
    const loadAllRepos = async () => {
      const repos = [];

      for (const installation of installations) {
        try {
          const installationRepos = await loadRepositories(installation.id);
          repos.push(
            ...installationRepos.map((repo) => ({
              id: repo.id,
              installationId: installation.id,
              name: repo.name,
              fullName: repo.full_name,
              defaultBranch: repo.default_branch,
              installation: installation.account.login,
            }))
          );
        } catch (error) {
          console.error(`Failed to load repos for ${installation.account.login}:`, error);
        }
      }

      setAllRepos(repos);
    };

    loadAllRepos();
  }, [installations]);

  // Filter repos based on search query and exclude already selected ones
  const filteredRepos = useMemo(() => {
    const selectedIds = new Set(selectedReposForNewTask.map((r) => r.id));

    return allRepos
      .filter((repo) => !selectedIds.has(repo.id))
      .filter((repo) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          repo.name.toLowerCase().includes(query) ||
          repo.fullName.toLowerCase().includes(query) ||
          repo.installation.toLowerCase().includes(query)
        );
      })
      .slice(0, 10); // Limit to 10 results for performance
  }, [allRepos, searchQuery, selectedReposForNewTask]);

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredRepos]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Add global keyboard listener (separate effect to avoid re-creating on deps change)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        // Check if our input is focused
        if (document.activeElement === inputRef.current) {
          e.preventDefault();
          // Don't call handleFinalize here, let the input's onKeyDown handle it
          // This prevents duplicate calls
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []); // Empty deps - only set up once

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) to create task
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      console.log('Cmd+Enter pressed, repos selected:', selectedReposForNewTask.length);
      if (selectedReposForNewTask.length > 0) {
        console.log('Finalizing task creation...');
        handleFinalize();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredRepos.length - 1));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;

      case 'Enter':
        e.preventDefault();
        if (filteredRepos[selectedIndex]) {
          addRepoToNewTask(filteredRepos[selectedIndex]);
          setSearchQuery('');
          setSelectedIndex(0);
          // Keep input focused after adding repo
          setTimeout(() => inputRef.current?.focus(), 0);
        }
        // Removed the else clause that would create task on Enter with empty search
        break;

      case 'Escape':
        e.preventDefault();
        if (searchQuery) {
          setSearchQuery('');
        } else if (selectedReposForNewTask.length === 0) {
          onCancel();
        } else {
          handleFinalize();
        }
        break;

      case 'Backspace':
        if (searchQuery === '' && selectedReposForNewTask.length > 0) {
          // Remove last selected repo
          const lastRepo = selectedReposForNewTask[selectedReposForNewTask.length - 1];
          removeRepoFromNewTask(lastRepo.id);
        }
        break;
    }
  };

  const handleFinalize = useCallback(async () => {
    // Prevent duplicate creation
    if (isCreating) {
      console.log('Already creating task, skipping duplicate call');
      return;
    }

    console.log('handleFinalize called with repos:', selectedReposForNewTask);
    if (selectedReposForNewTask.length === 0) {
      console.log('No repos selected, canceling');
      onCancel();
      return;
    }

    setIsCreating(true);

    try {
      console.log('Calling finalizeTaskCreation...');
      const task = await finalizeTaskCreation();
      console.log('Task created:', task);
      if (task) {
        onComplete();
      }
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setIsCreating(false);
    }
  }, [selectedReposForNewTask, finalizeTaskCreation, onCancel, onComplete, isCreating]);

  return (
    <div className="bg-card rounded-md border p-2">
      {/* Selected repos */}
      {selectedReposForNewTask.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {selectedReposForNewTask.map((repo) => (
            <div
              key={repo.id}
              className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
            >
              <span>{repo.name}</span>
              <button onClick={() => removeRepoFromNewTask(repo.id)} className="hover:bg-primary/20 rounded p-0.5">
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2.5 left-2 h-3 w-3" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search repositories..."
          className="w-full border-0 bg-transparent py-2 pr-3 pl-7 text-sm outline-none focus:ring-0"
        />
      </div>

      {/* Filtered results */}
      {searchQuery && filteredRepos.length > 0 && (
        <div className="mt-2 border-t pt-2">
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {filteredRepos.map((repo, index) => (
              <button
                key={repo.id}
                onClick={() => {
                  addRepoToNewTask(repo);
                  setSearchQuery('');
                  inputRef.current?.focus();
                }}
                className={cn(
                  'hover:bg-accent w-full rounded px-2 py-1.5 text-left text-sm',
                  index === selectedIndex && 'bg-accent'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{repo.name}</span>
                  <span className="text-muted-foreground text-xs">{repo.installation}</span>
                </div>
                <div className="text-muted-foreground text-xs">{repo.fullName}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-2">
          <kbd className="bg-muted rounded px-1 py-0.5 text-[10px]">Enter</kbd>
          Add repo
          {selectedReposForNewTask.length > 0 && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <kbd className="bg-muted rounded px-1 py-0.5 text-[10px]">⌘ Enter</kbd>
              Create task
            </>
          )}
          <span className="text-muted-foreground/50">•</span>
          <kbd className="bg-muted rounded px-1 py-0.5 text-[10px]">Esc</kbd>
          Cancel
        </span>
        {selectedReposForNewTask.length > 0 && (
          <button onClick={handleFinalize} className="text-primary hover:text-primary/80 text-xs underline">
            Create Task
          </button>
        )}
      </div>
    </div>
  );
};
