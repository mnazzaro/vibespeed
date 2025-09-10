import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth';
import { GitHubRepository } from '../../../shared/types/auth';
import { Button } from '@/components/ui/button';
import { Search, GitBranch, Lock, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RepositoryPickerProps {
  onSelect?: (repository: GitHubRepository) => void;
  multiSelect?: boolean;
}

export const RepositoryPicker: React.FC<RepositoryPickerProps> = ({ 
  onSelect, 
  multiSelect = false 
}) => {
  const { currentInstallation, loadRepositories } = useAuthStore();
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (currentInstallation) {
      loadRepos();
    }
  }, [currentInstallation]);
  
  const loadRepos = async () => {
    if (!currentInstallation) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const repos = await loadRepositories(currentInstallation.id);
      setRepositories(repos);
    } catch (err) {
      setError('Failed to load repositories');
      console.error('Failed to load repositories:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSelect = (repo: GitHubRepository) => {
    if (multiSelect) {
      const newSelection = new Set(selectedRepos);
      if (newSelection.has(repo.id)) {
        newSelection.delete(repo.id);
      } else {
        newSelection.add(repo.id);
      }
      setSelectedRepos(newSelection);
    }
    onSelect?.(repo);
  };
  
  const filteredRepos = repositories.filter(repo =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (!currentInstallation) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">
          Select an installation to view repositories
        </p>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Loading repositories...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button onClick={loadRepos} variant="outline" size="sm" className="mt-2">
          Retry
        </Button>
      </div>
    );
  }
  
  return (
    <div>
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-md border bg-background px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {filteredRepos.length} of {repositories.length}
        </span>
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredRepos.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">
              {searchTerm ? 'No repositories match your search' : 'No repositories found'}
            </p>
          </div>
        ) : (
          filteredRepos.map((repo) => (
            <button
              key={repo.id}
              onClick={() => handleSelect(repo)}
              className={cn(
                "w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent",
                selectedRepos.has(repo.id) && "border-primary bg-accent"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{repo.name}</span>
                    {repo.private ? (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <Globe className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  {repo.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {repo.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    {repo.language && (
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-primary"></span>
                        {repo.language}
                      </span>
                    )}
                  </div>
                </div>
                {multiSelect && (
                  <input
                    type="checkbox"
                    checked={selectedRepos.has(repo.id)}
                    onChange={() => {}}
                    className="ml-4 h-4 w-4 rounded border-gray-300"
                  />
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};