import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth';
import { GitHubRepository } from '../../../shared/types/auth';

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
    } else {
      setSelectedRepos(new Set([repo.id]));
      onSelect?.(repo);
    }
  };
  
  const filteredRepos = repositories.filter(repo => 
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (!currentInstallation) {
    return (
      <div className="repository-picker empty">
        <p>Please select an installation first</p>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="repository-picker loading">
        <div className="spinner"></div>
        <p>Loading repositories...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="repository-picker error">
        <p>{error}</p>
        <button onClick={loadRepos} className="retry-button">
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="repository-picker">
      <div className="repository-search">
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <svg 
          className="search-icon" 
          width="16" 
          height="16" 
          viewBox="0 0 16 16"
        >
          <path 
            d="M11.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM10.06 10.06l3.88 3.88"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
      
      <div className="repository-list">
        {filteredRepos.length === 0 ? (
          <p className="no-results">No repositories found</p>
        ) : (
          filteredRepos.map((repo) => (
            <div
              key={repo.id}
              className={`repository-item ${
                selectedRepos.has(repo.id) ? 'selected' : ''
              }`}
              onClick={() => handleSelect(repo)}
            >
              {multiSelect && (
                <input
                  type="checkbox"
                  checked={selectedRepos.has(repo.id)}
                  onChange={() => handleSelect(repo)}
                  className="repo-checkbox"
                />
              )}
              
              <div className="repo-info">
                <div className="repo-header">
                  <span className="repo-name">{repo.name}</span>
                  {repo.private && (
                    <span className="repo-badge private">Private</span>
                  )}
                  {repo.archived && (
                    <span className="repo-badge archived">Archived</span>
                  )}
                </div>
                
                {repo.description && (
                  <p className="repo-description">{repo.description}</p>
                )}
                
                <div className="repo-meta">
                  {repo.language && (
                    <span className="repo-language">
                      <span 
                        className="language-color" 
                        style={{ backgroundColor: getLanguageColor(repo.language) }}
                      />
                      {repo.language}
                    </span>
                  )}
                  
                  <span className="repo-updated">
                    Updated {formatDate(repo.updated_at)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {multiSelect && selectedRepos.size > 0 && (
        <div className="repository-actions">
          <button 
            className="select-button"
            onClick={() => {
              const selected = repositories.filter(r => selectedRepos.has(r.id));
              selected.forEach(repo => onSelect?.(repo));
            }}
          >
            Select {selectedRepos.size} {selectedRepos.size === 1 ? 'repository' : 'repositories'}
          </button>
        </div>
      )}
    </div>
  );
};

function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    TypeScript: '#2b7489',
    JavaScript: '#f1e05a',
    Python: '#3572A5',
    Java: '#b07219',
    Go: '#00ADD8',
    Rust: '#dea584',
    Ruby: '#701516',
    PHP: '#4F5D95',
    'C++': '#f34b7d',
    C: '#555555',
    'C#': '#178600',
    Swift: '#FA7343',
    Kotlin: '#A97BFF',
    Dart: '#00B4AB',
    Vue: '#41b883',
    React: '#61dafb',
  };
  
  return colors[language] || '#586069';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'today';
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  }
}