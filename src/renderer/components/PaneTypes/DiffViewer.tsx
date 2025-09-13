import { useVirtualizer } from '@tanstack/react-virtual';
import { X, GitBranch, ChevronUp, ChevronDown, MinusSquare, PlusSquare } from 'lucide-react';
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';

import { cn } from '@/lib/utils';

interface FileInfo {
  path: string;
  status?: 'A' | 'M' | 'D' | 'R' | '?';
  additions?: number;
  deletions?: number;
}

interface DiffViewerProps {
  taskId: string;
  repoName: string;
  filePath: string;
  allFiles?: FileInfo[];
  onClose: () => void;
}

interface DiffLine {
  type: 'header' | 'context' | 'addition' | 'deletion' | 'info' | 'expand' | 'separator';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  expandBefore?: number; // Line number to expand before
  expandAfter?: number; // Line number to expand after
  fileIndex?: number; // Which file this line belongs to
}

interface FileDiff {
  path: string;
  lines: DiffLine[];
  collapsed: boolean;
  additions: number;
  deletions: number;
  status?: string;
}

const COLLAPSE_THRESHOLD = 50; // Collapse diffs with more than 50 lines by default
const LINES_TO_EXPAND = 10; // Number of lines to expand when clicking expand button

const DiffViewer: React.FC<DiffViewerProps> = ({ taskId, repoName, filePath, allFiles, onClose }) => {
  const [fileDiffs, setFileDiffs] = useState<FileDiff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRanges, setExpandedRanges] = useState<Map<string, Set<string>>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Parse diff content into structured lines
  const parseDiff = useCallback((diff: string, fileIndex: number): DiffLine[] => {
    const lines = diff.split('\n');
    const result: DiffLine[] = [];
    let oldLineNum = 0;
    let newLineNum = 0;
    let lastContextLine = -1;
    let firstChangeLineInHunk = -1;
    let isFirstHunk = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip git diff header lines (but not hunk headers)
      if (
        line.startsWith('diff --git') ||
        line.startsWith('index ') ||
        line.startsWith('---') ||
        line.startsWith('+++') ||
        line.startsWith('new file mode') ||
        line.startsWith('deleted file mode')
      ) {
        continue;
      }

      if (line.startsWith('@@')) {
        // Parse hunk header
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          const oldStart = parseInt(match[1], 10);
          const newStart = parseInt(match[2], 10);

          // Add expand button before hunk
          if (isFirstHunk && oldStart > 1) {
            // First hunk and doesn't start at line 1
            result.push({
              type: 'expand',
              content: `Expand ${oldStart - 1} lines above`,
              expandBefore: oldStart - 1,
              expandAfter: 0,
              fileIndex,
            });
          } else if (!isFirstHunk && lastContextLine >= 0 && oldStart > lastContextLine + 1) {
            // Subsequent hunks with gap
            result.push({
              type: 'expand',
              content: `Expand ${oldStart - lastContextLine - 1} lines`,
              expandBefore: oldStart - 1,
              expandAfter: lastContextLine + 1,
              fileIndex,
            });
          }

          // Set line numbers to start - 1 since they'll be incremented when used
          oldLineNum = oldStart - 1;
          newLineNum = newStart - 1;
          firstChangeLineInHunk = -1;
          isFirstHunk = false;
        }
        // Don't show the @@ header line itself
      } else if (line.startsWith('+')) {
        if (firstChangeLineInHunk === -1) firstChangeLineInHunk = result.length;
        newLineNum++;
        result.push({
          type: 'addition',
          content: line.substring(1),
          newLineNumber: newLineNum,
          fileIndex,
        });
      } else if (line.startsWith('-')) {
        if (firstChangeLineInHunk === -1) firstChangeLineInHunk = result.length;
        oldLineNum++;
        result.push({
          type: 'deletion',
          content: line.substring(1),
          oldLineNumber: oldLineNum,
          fileIndex,
        });
      } else if (line !== '') {
        // Context line
        oldLineNum++;
        newLineNum++;
        result.push({
          type: 'context',
          content: line.startsWith(' ') ? line.substring(1) : line,
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
          fileIndex,
        });
        lastContextLine = oldLineNum;
      }
    }

    // Add expand button after last hunk if needed
    if (lastContextLine > 0) {
      result.push({
        type: 'expand',
        content: 'Expand lines below',
        expandBefore: -1, // Special marker for end of file
        expandAfter: lastContextLine,
        fileIndex,
      });
    }

    return result;
  }, []);

  // Fetch all diffs at once
  useEffect(() => {
    const fetchAllDiffs = async () => {
      try {
        setLoading(true);
        setError(null);

        const files = allFiles || [{ path: filePath }];
        const diffs: FileDiff[] = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const response = await window.electronAPI.tasks.getFileDiff(taskId, repoName, file.path);

          if (response.success && response.data) {
            const lines = parseDiff(response.data, i);
            const additions = lines.filter((l) => l.type === 'addition').length;
            const deletions = lines.filter((l) => l.type === 'deletion').length;

            diffs.push({
              path: file.path,
              lines,
              collapsed: lines.length > COLLAPSE_THRESHOLD,
              additions: file.additions ?? additions,
              deletions: file.deletions ?? deletions,
              status: file.status,
            });
          } else {
            // Even if no diff, add the file to maintain order
            diffs.push({
              path: file.path,
              lines: [],
              collapsed: false,
              additions: 0,
              deletions: 0,
              status: file.status,
            });
          }
        }

        setFileDiffs(diffs);
      } catch (err) {
        console.error('Failed to fetch diffs:', err);
        setError('Failed to fetch diffs');
      } finally {
        setLoading(false);
      }
    };

    fetchAllDiffs();
  }, [taskId, repoName, filePath, allFiles, parseDiff]);

  // Handle expanding context
  const handleExpandContext = useCallback(
    async (fileIndex: number, filePath: string, expandBefore: number, expandAfter: number) => {
      const key = `${fileIndex}-${expandBefore}-${expandAfter}`;
      const fileKey = filePath;

      // Check if already expanded
      const fileExpanded = expandedRanges.get(fileKey) || new Set();
      if (fileExpanded.has(key)) {
        return;
      }

      try {
        // Calculate the range to fetch
        let startLine: number;
        let endLine: number;

        if (expandAfter === 0) {
          // Expanding from the beginning of the file
          startLine = 1;
          endLine = Math.min(expandBefore, LINES_TO_EXPAND);
        } else if (expandBefore === -1) {
          // Expanding at the end of file
          startLine = expandAfter + 1;
          endLine = expandAfter + LINES_TO_EXPAND;
        } else {
          // Expanding in the middle
          startLine = expandAfter + 1;
          endLine = Math.min(expandBefore, expandAfter + LINES_TO_EXPAND);
        }

        // Fetch the context lines
        const response = await window.electronAPI.tasks.getFileContext(taskId, repoName, filePath, startLine, endLine);

        if (response.success && response.data) {
          const contextLines = response.data;

          setFileDiffs((prev) => {
            return prev.map((diff, idx) => {
              if (idx !== fileIndex) return diff;

              const newLines: DiffLine[] = [];
              let inserted = false;

              for (const line of diff.lines) {
                if (
                  !inserted &&
                  line.type === 'expand' &&
                  line.expandBefore === expandBefore &&
                  line.expandAfter === expandAfter
                ) {
                  // Replace expand button with context lines
                  contextLines.forEach((content, i) => {
                    const lineNum = startLine + i;
                    newLines.push({
                      type: 'context',
                      content,
                      oldLineNumber: lineNum,
                      newLineNumber: lineNum,
                      fileIndex,
                    });
                  });

                  // Add new expand buttons if there's more to expand
                  if (expandAfter === 0 && contextLines.length > 0) {
                    // Expanded from beginning, check if more to expand
                    const lastLine = startLine + contextLines.length - 1;
                    if (lastLine < expandBefore) {
                      newLines.push({
                        type: 'expand',
                        content: `Expand ${expandBefore - lastLine} more lines`,
                        expandBefore: expandBefore,
                        expandAfter: lastLine,
                        fileIndex,
                      });
                    }
                  } else if (expandBefore === -1 && contextLines.length === LINES_TO_EXPAND) {
                    // Expanding at end of file, might have more
                    newLines.push({
                      type: 'expand',
                      content: 'Expand more lines below',
                      expandBefore: -1,
                      expandAfter: startLine + contextLines.length - 1,
                      fileIndex,
                    });
                  } else if (expandBefore !== -1 && contextLines.length > 0) {
                    // Expanding in middle
                    const lastLine = startLine + contextLines.length - 1;
                    if (lastLine < expandBefore) {
                      newLines.push({
                        type: 'expand',
                        content: `Expand ${expandBefore - lastLine} more lines`,
                        expandBefore: expandBefore,
                        expandAfter: lastLine,
                        fileIndex,
                      });
                    }
                  }

                  inserted = true;
                } else {
                  newLines.push(line);
                }
              }

              return { ...diff, lines: newLines };
            });
          });

          // Mark as expanded
          setExpandedRanges((prev) => {
            const newMap = new Map(prev);
            const fileSet = newMap.get(fileKey) || new Set();
            fileSet.add(key);
            newMap.set(fileKey, fileSet);
            return newMap;
          });
        }
      } catch (err) {
        console.error('Failed to expand context:', err);
      }
    },
    [taskId, repoName, expandedRanges]
  );

  // Toggle file collapse
  const toggleFileCollapse = useCallback((index: number) => {
    setFileDiffs((prev) => prev.map((diff, idx) => (idx === index ? { ...diff, collapsed: !diff.collapsed } : diff)));
  }, []);

  // Flatten all lines for virtualization
  const allLines = useMemo(() => {
    const lines: (DiffLine & { fileIndex: number; filePath: string })[] = [];

    fileDiffs.forEach((diff, fileIndex) => {
      // Add separator before file (except for first file)
      if (fileIndex > 0) {
        lines.push({
          type: 'separator',
          content: '',
          fileIndex,
          filePath: diff.path,
        });
      }

      // Add file header
      lines.push({
        type: 'header',
        content: diff.path,
        fileIndex,
        filePath: diff.path,
      });

      // Add lines if not collapsed
      if (!diff.collapsed) {
        diff.lines.forEach((line) => {
          lines.push({
            ...line,
            fileIndex,
            filePath: diff.path,
          });
        });
      }
    });

    return lines;
  }, [fileDiffs]);

  // Setup virtualizer
  const virtualizer = useVirtualizer({
    count: allLines.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => {
      const line = allLines[index];
      // File headers are taller
      if (line?.type === 'header') return 48;
      // Separator lines
      if (line?.type === 'separator') return 32;
      // Regular lines
      return 22;
    },
    overscan: 10,
  });

  // Scroll to file
  const scrollToFile = useCallback(
    (filePath: string) => {
      const index = allLines.findIndex((line) => line.type === 'header' && line.filePath === filePath);

      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: 'start' });
      }
    },
    [allLines, virtualizer]
  );

  // Auto-scroll to the initially selected file when component mounts or allLines changes
  useEffect(() => {
    // Auto-scroll to the clicked file when allLines has been populated
    if (filePath && allLines.length > 0) {
      // Small delay to ensure virtualizer is ready
      setTimeout(() => {
        scrollToFile(filePath);
      }, 100);
    }
  }, [filePath, allLines, scrollToFile]);

  // Get line background color
  const getLineBackground = (type: DiffLine['type']) => {
    switch (type) {
      case 'addition':
        return 'bg-green-500/10';
      case 'deletion':
        return 'bg-red-500/10';
      case 'header':
        return 'bg-muted/50';
      case 'expand':
        return 'bg-muted/30 hover:bg-muted/50';
      default:
        return '';
    }
  };

  // Get line text color
  const getLineTextColor = (type: DiffLine['type']) => {
    switch (type) {
      case 'addition':
        return 'text-green-800 dark:text-green-500';
      case 'deletion':
        return 'text-red-800 dark:text-red-500';
      case 'header':
        return 'text-foreground font-semibold';
      case 'expand':
        return 'text-muted-foreground';
      default:
        return '';
    }
  };

  // Get file status color and label
  const getFileStatusInfo = (status?: string) => {
    switch (status) {
      case 'A':
        return { color: 'text-green-500', label: 'A' };
      case 'M':
        return { color: 'text-yellow-500', label: 'M' };
      case 'D':
        return { color: 'text-red-500', label: 'D' };
      case 'R':
        return { color: 'text-blue-500', label: 'R' };
      case '?':
        return { color: 'text-green-500', label: 'A' };
      default:
        return { color: 'text-gray-400', label: '?' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background flex max-h-[90vh] w-[95%] flex-col rounded-lg border shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            <div>
              <h2 className="font-mono text-lg font-semibold">{repoName}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="hover:bg-muted rounded p-2 transition-colors" title="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main content area with sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* File list sidebar */}
          {allFiles && allFiles.length > 0 && (
            <div className="flex w-64 flex-col border-r">
              <div className="flex-1 overflow-y-auto">
                {fileDiffs.map((diff, index) => {
                  const file = allFiles[index];
                  const statusInfo = getFileStatusInfo(file?.status);
                  const fileName = diff.path.split('/').pop() || diff.path;

                  return (
                    <button
                      key={diff.path}
                      onClick={() => scrollToFile(diff.path)}
                      className="hover:bg-muted/50 flex w-full items-start gap-2 px-3 py-2 text-left transition-colors"
                    >
                      <span className={cn('w-4 flex-shrink-0 text-left font-mono text-sm', statusInfo.color)}>
                        {statusInfo.label}
                      </span>

                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="truncate font-mono text-sm" title={diff.path}>
                          {fileName}
                        </div>
                        <div className="text-muted-foreground truncate font-mono text-xs" title={diff.path}>
                          {diff.path}
                        </div>
                      </div>

                      <div className="flex flex-shrink-0 items-center gap-2">
                        {diff.additions > 0 && (
                          <span className="font-mono text-xs text-green-800 dark:text-green-500">
                            +{diff.additions}
                          </span>
                        )}
                        {diff.deletions > 0 && (
                          <span className="font-mono text-xs text-red-800 dark:text-red-500">-{diff.deletions}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Diff content area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="border-primary mb-2 h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                  <p className="text-muted-foreground text-sm">Loading diffs...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              </div>
            ) : allLines.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground">No changes found</p>
              </div>
            ) : (
              <div ref={scrollContainerRef} className="flex-1 overflow-auto font-mono text-xs">
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualItem) => {
                    const line = allLines[virtualItem.index];
                    const isFileHeader = line.type === 'header';
                    const isSeparator = line.type === 'separator';
                    const diff = fileDiffs[line.fileIndex];

                    return (
                      <div
                        key={virtualItem.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualItem.size}px`,
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        {isSeparator ? (
                          <div className="flex h-full items-center">
                            <div className="mx-6 h-[1px] w-full bg-black" />
                          </div>
                        ) : isFileHeader ? (
                          <div className={cn('border-border/30 flex h-full items-center border-b px-4', 'bg-muted/60')}>
                            <button
                              onClick={() => toggleFileCollapse(line.fileIndex)}
                              className="hover:bg-muted/80 mr-2 rounded p-1"
                            >
                              {diff.collapsed ? (
                                <PlusSquare className="h-4 w-4" />
                              ) : (
                                <MinusSquare className="h-4 w-4" />
                              )}
                            </button>
                            <span className="font-mono text-sm">{line.content}</span>
                            <span className="text-muted-foreground ml-4 text-xs">
                              {diff.additions > 0 && (
                                <span className="mr-2 text-green-800 dark:text-green-500">+{diff.additions}</span>
                              )}
                              {diff.deletions > 0 && (
                                <span className="text-red-800 dark:text-red-500">-{diff.deletions}</span>
                              )}
                            </span>
                          </div>
                        ) : line.type === 'expand' ? (
                          <div className="flex h-full">
                            {/* Empty line numbers column for expand buttons */}
                            <div className="bg-muted/10 border-border/20 flex flex-shrink-0 border-r">
                              <span className="w-10"></span>
                              <span className="w-10"></span>
                              <span className="w-4"></span>
                            </div>
                            <button
                              onClick={() =>
                                handleExpandContext(
                                  line.fileIndex!,
                                  line.filePath,
                                  line.expandBefore!,
                                  line.expandAfter!
                                )
                              }
                              className={cn(
                                'flex flex-1 items-center gap-2 px-4 text-left transition-colors',
                                getLineBackground(line.type)
                              )}
                            >
                              {line.expandBefore === -1 ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronUp className="h-3 w-3" />
                              )}
                              <span className={getLineTextColor(line.type)}>{line.content}</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex h-full">
                            {/* Line numbers column - fixed width */}
                            <div className="bg-muted/10 border-border/20 flex flex-shrink-0 border-r">
                              <span className="text-muted-foreground flex w-10 items-center justify-end px-1 text-right text-[10px] select-none">
                                {line.type === 'deletion' || line.type === 'context' ? line.oldLineNumber : ''}
                              </span>
                              <span className="text-muted-foreground flex w-10 items-center justify-end px-1 text-right text-[10px] select-none">
                                {line.type === 'addition' || line.type === 'context' ? line.newLineNumber : ''}
                              </span>
                              <span className="flex w-4 items-center justify-center px-1 select-none">
                                {line.type === 'addition' && (
                                  <span className="text-green-800 dark:text-green-500">+</span>
                                )}
                                {line.type === 'deletion' && <span className="text-red-800 dark:text-red-500">-</span>}
                              </span>
                            </div>
                            {/* Content column - allows horizontal overflow */}
                            <div
                              className={cn('flex flex-1 items-center overflow-x-auto', getLineBackground(line.type))}
                            >
                              <span className={cn('px-2 whitespace-pre', getLineTextColor(line.type))}>
                                {line.content}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiffViewer;
