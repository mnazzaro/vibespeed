import { ChevronRight, File, Folder, FolderOpen, Trash2, Edit2, Copy } from 'lucide-react';
import React, { useEffect, useState, useCallback, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePaneStore } from '@/renderer/store/panes';
import { useTaskStore } from '@/renderer/store/tasks';
import { PaneConfig, FileNode } from '@/shared/types/panes';

interface FileExplorerPaneProps {
  paneId: string;
  config: PaneConfig;
  isActive: boolean;
}

const FileExplorerPane: React.FC<FileExplorerPaneProps> = ({ paneId }) => {
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileNode } | null>(null);

  const { fileExplorerStates, initFileExplorer, updateFileExplorerState, toggleDirectory, selectFile } = usePaneStore();

  const { activeTask } = useTaskStore();

  const state = fileExplorerStates[paneId];

  // Get the current task's worktree path
  const getTaskRootPath = useCallback(() => {
    if (activeTask && activeTask.repositories.length > 0) {
      return activeTask.worktreeBasePath;
    }
    return null;
  }, [activeTask]);

  const taskRootPath = getTaskRootPath();

  // Get repository name for display
  const getRepositoryName = useCallback(() => {
    return activeTask?.name || '';
  }, [activeTask]);

  // Initialize and update file explorer when task changes
  useEffect(() => {
    if (!taskRootPath) {
      // Clear state when no task is active
      if (state) {
        updateFileExplorerState(paneId, {
          fileTree: undefined,
          currentPath: '',
          selectedFiles: [],
        });
      }
      return;
    }

    // Initialize or update the file explorer with new task path
    if (!state || state.rootPath !== taskRootPath) {
      initFileExplorer(paneId, taskRootPath);
      loadDirectory(taskRootPath);
    }
  }, [taskRootPath, paneId, state?.rootPath]);

  // Load directory contents
  const loadDirectory = async (path: string) => {
    if (!taskRootPath || !path.startsWith(taskRootPath)) {
      console.warn('Attempted to load directory outside task root:', path);
      return;
    }

    try {
      updateFileExplorerState(paneId, { currentPath: path });
      const files = await window.electronAPI.files.readDirectory(path);

      // Build file tree
      const relativeName =
        path === taskRootPath
          ? getRepositoryName()
          : path
              .substring(taskRootPath.length + 1)
              .split('/')
              .pop() || 'root';

      const tree: FileNode = {
        name: relativeName,
        path,
        type: 'directory',
        children: files,
        isExpanded: true,
      };

      updateFileExplorerState(paneId, { fileTree: tree });

      // Start watching for changes
      await window.electronAPI.files.watch(path);
    } catch (error) {
      console.error('Failed to load directory:', error);
    }
  };

  // Load subdirectory contents
  const loadSubdirectory = async (node: FileNode) => {
    if (node.type !== 'directory' || node.isLoading) return;

    // Ensure we're within task bounds
    if (!taskRootPath || !node.path.startsWith(taskRootPath)) {
      console.warn('Attempted to load subdirectory outside task root:', node.path);
      return;
    }

    try {
      // Mark as loading
      updateNodeInTree(node.path, { isLoading: true });

      const files = await window.electronAPI.files.readDirectory(node.path);

      // Update node with children
      updateNodeInTree(node.path, {
        children: files,
        isExpanded: true,
        isLoading: false,
      });

      // Start watching this directory
      await window.electronAPI.files.watch(node.path);
    } catch (error) {
      console.error('Failed to load subdirectory:', error);
      updateNodeInTree(node.path, { isLoading: false });
    }
  };

  // Update a node in the file tree
  const updateNodeInTree = (path: string, updates: Partial<FileNode>) => {
    if (!state?.fileTree) return;

    const updateNode = (node: FileNode): FileNode => {
      if (node.path === path) {
        return { ...node, ...updates };
      }

      if (node.children) {
        return {
          ...node,
          children: node.children.map(updateNode),
        };
      }

      return node;
    };

    updateFileExplorerState(paneId, {
      fileTree: updateNode(state.fileTree),
    });
  };

  // Handle file/directory click
  const handleNodeClick = async (node: FileNode, e: React.MouseEvent) => {
    e.stopPropagation();

    if (e.metaKey || e.ctrlKey) {
      // Multi-select
      selectFile(paneId, node.path, true);
    } else {
      // Single select
      selectFile(paneId, node.path, false);

      if (node.type === 'directory') {
        if (node.isExpanded) {
          toggleDirectory(paneId, node.path);
          updateNodeInTree(node.path, { isExpanded: false });
        } else {
          if (!node.children) {
            await loadSubdirectory(node);
          } else {
            toggleDirectory(paneId, node.path);
            updateNodeInTree(node.path, { isExpanded: true });
          }
        }
      } else {
        // TODO: Make this open a new VSCode/Cursor window instead of opening in the existing one
        try {
          await window.electronAPI.files.openInEditor(node.path);
        } catch (error) {
          console.error('Failed to open file in editor:', error);
        }
      }
    }
  };

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file: node });
  };

  // Create new file/folder
  const handleCreate = async (type: 'file' | 'directory') => {
    if (!state?.currentPath || !newFileName) return;

    const newPath = `${state.currentPath}/${newFileName}`;

    try {
      if (type === 'directory') {
        await window.electronAPI.files.createDirectory(newPath);
      } else {
        await window.electronAPI.files.writeFile(newPath, '');
      }

      // Reload directory
      await loadDirectory(state.currentPath);
      setIsCreatingFile(false);
      setNewFileName('');
    } catch (error) {
      console.error(`Failed to create ${type}:`, error);
    }
  };

  // Delete file/folder
  const handleDelete = async (node: FileNode) => {
    if (!confirm(`Are you sure you want to delete "${node.name}"?`)) return;

    try {
      await window.electronAPI.files.delete(node.path);

      // Reload parent directory
      const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
      await loadDirectory(parentPath || state?.rootPath || taskRootPath || '/');
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  // Rename file/folder
  const handleRename = async (node: FileNode) => {
    if (!renameValue || renameValue === node.name) {
      setRenamingFile(null);
      return;
    }

    const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
    const newPath = `${parentPath}/${renameValue}`;

    try {
      await window.electronAPI.files.rename(node.path, newPath);

      // Reload directory
      await loadDirectory(parentPath || state?.rootPath || taskRootPath || '/');
      setRenamingFile(null);
      setRenameValue('');
    } catch (error) {
      console.error('Failed to rename:', error);
    }
  };

  // Copy file path (relative to task root)
  const copyPath = (path: string) => {
    if (taskRootPath && path.startsWith(taskRootPath)) {
      // Copy relative path
      const relativePath = path.substring(taskRootPath.length + 1);
      navigator.clipboard.writeText(relativePath || '.');
    } else {
      navigator.clipboard.writeText(path);
    }
  };

  // Get file icon based on extension
  const getFileIcon = (node: FileNode) => {
    if (node.type === 'directory') {
      return node.isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />;
    }

    // Return file icon based on extension
    const ext = node.extension?.toLowerCase();
    const iconClass = 'h-4 w-4';

    // Programming languages
    if (['ts', 'tsx', 'js', 'jsx'].includes(ext || '')) {
      return <File className={cn(iconClass, 'text-yellow-500')} />;
    }
    if (['py'].includes(ext || '')) {
      return <File className={cn(iconClass, 'text-blue-500')} />;
    }
    if (['json', 'xml', 'yaml', 'yml'].includes(ext || '')) {
      return <File className={cn(iconClass, 'text-orange-500')} />;
    }
    if (['md', 'mdx'].includes(ext || '')) {
      return <File className={cn(iconClass, 'text-gray-400')} />;
    }

    return <File className="h-4 w-4" />;
  };

  // Filter and sort files
  const processFileTree = useCallback(
    (node: FileNode): FileNode | null => {
      if (!state) return null;

      // Sort children
      if (node.children) {
        let sortedChildren = [...node.children];

        // Sort directories first, then by selected criteria
        sortedChildren.sort((a, b) => {
          if (a.type === 'directory' && b.type === 'file') return -1;
          if (a.type === 'file' && b.type === 'directory') return 1;

          let comparison = 0;
          switch (state.sortBy) {
            case 'name':
              comparison = a.name.localeCompare(b.name);
              break;
            case 'type':
              comparison = (a.extension || '').localeCompare(b.extension || '');
              break;
            case 'size':
              comparison = (a.size || 0) - (b.size || 0);
              break;
            case 'modified':
              comparison = (a.modified || 0) - (b.modified || 0);
              break;
          }

          return state.sortOrder === 'asc' ? comparison : -comparison;
        });

        return {
          ...node,
          children: sortedChildren.map(processFileTree).filter(Boolean) as FileNode[],
        };
      }

      return node;
    },
    [state]
  );

  // Render file tree node
  const renderNode = (node: FileNode, depth: number = 0) => {
    const isSelected = state?.selectedFiles.includes(node.path);
    const isRenaming = renamingFile === node.path;

    return (
      <div key={node.path}>
        <div
          className={cn(
            'group hover:bg-muted/50 flex h-7 cursor-pointer items-center gap-1 px-2',
            isSelected && 'bg-primary/10',
            depth > 0 && 'border-muted border-l'
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={(e) => handleNodeClick(node, e)}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          {node.type === 'directory' && (
            <ChevronRight className={cn('h-3 w-3 transition-transform', node.isExpanded && 'rotate-90')} />
          )}

          <span className="flex-shrink-0">{getFileIcon(node)}</span>

          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => handleRename(node)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(node);
                if (e.key === 'Escape') setRenamingFile(null);
              }}
              className="flex-1 bg-transparent text-sm outline-none"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 truncate text-sm">{node.name}</span>
          )}

          {node.type === 'file' && node.size && (
            <span className="text-muted-foreground text-xs opacity-0 group-hover:opacity-100">
              {formatFileSize(node.size)}
            </span>
          )}
        </div>

        {node.type === 'directory' && node.isExpanded && node.children && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Process the file tree
  const processedTree = useMemo(() => {
    if (!state?.fileTree) return null;
    return processFileTree(state.fileTree);
  }, [state?.fileTree, processFileTree]);

  // Handle file system changes
  useEffect(() => {
    const handleFileChange = (path: string) => {
      // Only handle changes within the task root
      if (!taskRootPath || !path.startsWith(taskRootPath)) return;

      // Reload the directory containing the changed file
      const dirPath = path.substring(0, path.lastIndexOf('/'));
      if (dirPath === state?.currentPath) {
        loadDirectory(state.currentPath);
      }
    };

    window.electronAPI.files.onChanged(handleFileChange);

    return () => {
      window.electronAPI.files.removeListeners();
    };
  }, [state?.currentPath, taskRootPath]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Show message when no task is active
  if (!taskRootPath) {
    return (
      <div className="bg-background flex h-full items-center justify-center">
        <div className="text-center">
          <Folder className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">No active task</p>
          <p className="text-muted-foreground mt-1 text-xs">Select a task to view its files</p>
        </div>
      </div>
    );
  }

  // Show message while task is initializing
  if (activeTask && activeTask.repositories[0]?.status === 'initializing') {
    return (
      <div className="bg-background flex h-full items-center justify-center">
        <div className="text-center">
          <div className="border-primary mb-2 h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          <p className="text-muted-foreground text-sm">Setting up repository...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full flex-col">
      {/* Create new file/folder */}
      {isCreatingFile && (
        <div className="flex items-center gap-2 border-b p-2">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="Enter name..."
            className="flex-1 rounded border px-2 py-1 text-xs outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newFileName) {
                handleCreate(e.shiftKey ? 'directory' : 'file');
              }
              if (e.key === 'Escape') {
                setIsCreatingFile(false);
                setNewFileName('');
              }
            }}
          />
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => handleCreate('file')}>
            File
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => handleCreate('directory')}>
            Folder
          </Button>
        </div>
      )}

      {/* Repository name header */}
      {state && (
        <div className="bg-muted/30 flex h-6 items-center gap-1 border-b px-2 text-xs font-medium">
          <Folder className="h-3 w-3" />
          <span>{getRepositoryName()}</span>
          {state.currentPath !== state.rootPath && (
            <>
              <ChevronRight className="text-muted-foreground h-3 w-3" />
              <span className="text-muted-foreground">{state.currentPath.substring(state.rootPath.length + 1)}</span>
            </>
          )}
        </div>
      )}

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        {processedTree ? (
          // Render children directly without the root node
          processedTree.children ? (
            processedTree.children.map((child) => renderNode(child, 0))
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground text-sm">Empty directory</p>
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">Loading...</p>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="bg-popover absolute z-50 rounded-md border p-1 shadow-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={() => {
              setRenamingFile(contextMenu.file.path);
              setRenameValue(contextMenu.file.name);
              setContextMenu(null);
            }}
          >
            <Edit2 className="mr-2 h-3 w-3" />
            Rename
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={() => {
              copyPath(contextMenu.file.path);
              setContextMenu(null);
            }}
          >
            <Copy className="mr-2 h-3 w-3" />
            Copy Path
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 w-full justify-start text-xs"
            onClick={() => {
              handleDelete(contextMenu.file);
              setContextMenu(null);
            }}
          >
            <Trash2 className="mr-2 h-3 w-3" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
};

export default FileExplorerPane;
