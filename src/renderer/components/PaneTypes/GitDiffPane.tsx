import { GitBranch, AlertCircle } from 'lucide-react';
import React, { useEffect, useState, useCallback, useRef } from 'react';

import { cn } from '@/lib/utils';
import { useTaskStore } from '@/renderer/store/tasks';
import { PaneConfig } from '@/shared/types/panes';

import DiffViewer from './DiffViewer';

interface GitDiffPaneProps {
  paneId: string;
  config: PaneConfig;
  isActive: boolean;
}

interface FileStatus {
  path: string;
  index: string;
  working_dir: string;
}

interface FileDiff {
  additions: number;
  deletions: number;
  binary?: boolean;
}

interface GitStatus {
  current: string;
  tracking: string | null;
  ahead: number;
  behind: number;
  created: string[];
  deleted: string[];
  modified: string[];
  renamed: Array<{ from: string; to: string }>;
  conflicted: string[];
  staged: string[];
  files: FileStatus[];
  not_added: string[];
  isClean: boolean;
}

interface EnhancedGitStatus extends GitStatus {
  diffs?: Record<string, FileDiff>;
  lastFetch?: Date;
}

interface FileInfo {
  path: string;
  status?: 'A' | 'M' | 'D' | 'R' | '?';
  additions?: number;
  deletions?: number;
}

const GitDiffPane: React.FC<GitDiffPaneProps> = () => {
  const { activeTask } = useTaskStore();
  const [gitStatuses, setGitStatuses] = useState<Record<string, EnhancedGitStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingDiff, setViewingDiff] = useState<{ repo: string; path: string; allFiles: FileInfo[] } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch git status with diff information
  const fetchGitStatus = useCallback(async () => {
    if (!activeTask) {
      setGitStatuses({});
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get basic git status
      const response = await window.electronAPI.tasks.getGitStatus(activeTask.id);

      if (response.success && response.data) {
        // Get diff stats for each repository
        const enhancedStatuses: Record<string, EnhancedGitStatus> = {};

        for (const [repoName, status] of Object.entries(response.data)) {
          // Get line diff counts if available
          const diffResponse = await window.electronAPI.tasks.getGitDiff?.(activeTask.id, repoName);

          enhancedStatuses[repoName] = {
            ...(status as GitStatus),
            diffs: diffResponse?.success ? diffResponse.data : undefined,
            lastFetch: new Date(),
          };
        }

        setGitStatuses(enhancedStatuses);
      } else {
        setError(response.error || 'Failed to fetch git status');
      }
    } catch (err) {
      console.error('Failed to fetch git status:', err);
      setError('Failed to fetch git status');
    } finally {
      setLoading(false);
    }
  }, [activeTask]);

  // Auto-refresh management
  useEffect(() => {
    if (activeTask) {
      fetchGitStatus();

      intervalRef.current = setInterval(fetchGitStatus, 2000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [fetchGitStatus, activeTask]);

  // Get file status character and color
  const getFileStatusInfo = (file: FileStatus) => {
    const index = file.index;
    const working = file.working_dir;

    // Prioritize staged changes (index)
    if (index !== ' ' && index !== '?') {
      switch (index) {
        case 'A':
          return { char: 'A', color: 'text-green-500', label: 'Added' };
        case 'M':
          return { char: 'M', color: 'text-yellow-500', label: 'Modified' };
        case 'D':
          return { char: 'D', color: 'text-red-500', label: 'Deleted' };
        case 'R':
          return { char: 'R', color: 'text-blue-500', label: 'Renamed' };
        case 'C':
          return { char: 'C', color: 'text-purple-500', label: 'Copied' };
        default:
          return { char: index, color: 'text-gray-400', label: 'Unknown' };
      }
    }

    // Then check working directory changes
    if (working !== ' ') {
      switch (working) {
        case 'M':
          return { char: 'M', color: 'text-yellow-500', label: 'Modified' };
        case 'D':
          return { char: 'D', color: 'text-red-500', label: 'Deleted' };
        case 'A':
          return { char: 'A', color: 'text-green-500', label: 'Added' };
        case '?':
          return { char: 'A', color: 'text-green-500', label: 'Untracked' }; // Show as 'A' for consistency
        default:
          return { char: working, color: 'text-gray-400', label: 'Unknown' };
      }
    }

    // File is clean (no changes)
    return { char: '', color: 'text-gray-400', label: 'Clean' };
  };

  // Get icon for file status
  const getFileIcon = (statusChar: string, color: string) => {
    // Return a colored letter indicator
    // Empty string means no changes (clean file)
    if (!statusChar) return null;

    return <span className={cn('w-4 flex-shrink-0 text-left font-mono text-sm', color)}>{statusChar}</span>;
  };

  // Get all files sorted by path
  const getAllFiles = useCallback((status: EnhancedGitStatus) => {
    return status.files
      .map((file) => ({
        file,
        diff: status.diffs?.[file.path],
        isStaged: file.index !== ' ' && file.index !== '?',
      }))
      .sort((a, b) => a.file.path.localeCompare(b.file.path));
  }, []);

  // Calculate total changes
  const calculateTotalChanges = useCallback((status: EnhancedGitStatus) => {
    let additions = 0;
    let deletions = 0;
    let filesChanged = status.files.length;

    if (status.diffs) {
      Object.values(status.diffs).forEach((diff) => {
        if (!diff.binary) {
          additions += diff.additions;
          deletions += diff.deletions;
        }
      });
    }

    return { additions, deletions, filesChanged };
  }, []);

  // Prepare file list for DiffViewer (sorted by path)
  const prepareFileList = useCallback((status: EnhancedGitStatus) => {
    return status.files
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((file) => {
        const statusInfo = getFileStatusInfo(file);
        const diff = status.diffs?.[file.path];

        // Map status character to expected type
        let fileStatus: 'A' | 'M' | 'D' | 'R' | '?' | undefined;
        switch (statusInfo.char) {
          case 'A':
            fileStatus = 'A';
            break;
          case 'M':
            fileStatus = 'M';
            break;
          case 'D':
            fileStatus = 'D';
            break;
          case 'R':
            fileStatus = 'R';
            break;
          case '?':
            fileStatus = '?';
            break;
          default:
            fileStatus = undefined;
        }

        return {
          path: file.path,
          status: fileStatus,
          additions: diff?.additions,
          deletions: diff?.deletions,
        };
      });
  }, []);

  // Loading state
  if (loading && Object.keys(gitStatuses).length === 0) {
    return (
      <div className="bg-background flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground text-sm">Loading git status...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-background flex h-full items-center justify-center">
        <div className="text-center">
          <AlertCircle className="text-destructive mx-auto mb-2 h-8 w-8" />
          <p className="text-destructive text-sm">{error}</p>
          <button onClick={fetchGitStatus} className="text-primary mt-2 text-xs hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full flex-col">
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(gitStatuses).map(([repoName, status]) => {
          const allFiles = getAllFiles(status);
          const hasChanges = status.files.length > 0;
          const totals = calculateTotalChanges(status);

          return (
            <div key={repoName} className="border-b last:border-b-0">
              {/* Repository header */}
              <button className="bg-muted/20 hover:bg-muted/30 flex w-full items-center justify-between px-3 py-2 transition-colors">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  <span className="font-mono text-sm font-medium">{repoName}</span>
                </div>

                {hasChanges && (
                  <div className="flex items-center gap-1.5">
                    {totals.additions > 0 && (
                      <span className="font-mono text-xs text-green-600">+{totals.additions}</span>
                    )}
                    {totals.deletions > 0 && (
                      <span className="font-mono text-xs text-red-600">-{totals.deletions}</span>
                    )}
                    <span className="border-muted-foreground/30 text-muted-foreground ml-1 rounded border px-2 py-0.5 font-mono text-xs">
                      {totals.filesChanged} {totals.filesChanged === 1 ? 'file' : 'files'}
                    </span>
                  </div>
                )}
              </button>

              {/* Files list */}
              {hasChanges && (
                <div>
                  {allFiles.map(({ file, diff }) => {
                    const statusInfo = getFileStatusInfo(file);

                    return (
                      <button
                        key={file.path}
                        className={cn(
                          'hover:bg-muted/50 flex w-full items-start gap-2 px-3 py-2 text-left transition-colors'
                        )}
                        onClick={() =>
                          setViewingDiff({
                            repo: repoName,
                            path: file.path,
                            allFiles: prepareFileList(status),
                          })
                        }
                      >
                        {/* File icon */}
                        {getFileIcon(statusInfo.char, statusInfo.color)}

                        {/* File name and path - constrained to not overflow */}
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="truncate font-mono text-sm" title={file.path}>
                            {file.path.split('/').pop() || file.path}
                          </div>
                          <div className="text-muted-foreground truncate font-mono text-xs" title={file.path}>
                            {file.path}
                          </div>
                        </div>

                        {/* Line changes - flex-shrink-0 ensures they don't get compressed */}
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {diff && !diff.binary && (
                            <div className="flex items-center gap-1">
                              {diff.additions > 0 && (
                                <span className="font-mono text-xs text-green-600">+{diff.additions}</span>
                              )}
                              {diff.deletions > 0 && (
                                <span className="font-mono text-xs text-red-600">-{diff.deletions}</span>
                              )}
                            </div>
                          )}

                          {diff?.binary && <span className="text-muted-foreground font-mono text-xs">Binary</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* File diff viewer modal */}
      {viewingDiff && activeTask && (
        <DiffViewer
          taskId={activeTask.id}
          repoName={viewingDiff.repo}
          filePath={viewingDiff.path}
          allFiles={viewingDiff.allFiles}
          onClose={() => setViewingDiff(null)}
        />
      )}
    </div>
  );
};

export default GitDiffPane;
