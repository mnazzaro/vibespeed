export enum PaneType {
  FILE_EXPLORER = 'file-explorer',
  TERMINAL = 'terminal',
  DEBUGGER = 'debugger',
  TESTS = 'tests',
  VERSION_CONTROL = 'version-control',
  DOCUMENTATION = 'documentation',
  METRICS = 'metrics',
  LOGS = 'logs',
  CUSTOM = 'custom',
}

export interface PaneConfig {
  id: string;
  type: PaneType;
  position: 'top' | 'bottom';
  size: number; // Percentage (0-100)
  minSize: number;
  maxSize: number;
  visible: boolean;
  resizable: boolean;
  collapsible: boolean;
  collapsed?: boolean;
  title?: string;
  metadata?: Record<string, any>;
}

export interface SavedLayout {
  id: string;
  name: string;
  description?: string;
  panes: PaneConfig[];
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
}

export interface PaneProps {
  paneId: string;
  config: PaneConfig;
  isActive: boolean;
  onClose?: () => void;
  onCollapse?: () => void;
  onSettings?: () => void;
}

// Terminal specific types
export interface TerminalSession {
  id: string;
  paneId: string;
  pid?: number;
  title: string;
  cwd: string;
  isActive: boolean;
  buffer?: string[];
}

// File Explorer specific types
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  modified?: number;
  isExpanded?: boolean;
  isSelected?: boolean;
  isLoading?: boolean;
  extension?: string;
}

export interface FileExplorerState {
  rootPath: string;
  currentPath: string;
  selectedFiles: string[];
  expandedDirectories: Set<string>;
  fileTree?: FileNode;
  showHiddenFiles: boolean;
  sortBy: 'name' | 'type' | 'size' | 'modified';
  sortOrder: 'asc' | 'desc';
}

// IPC types for pane operations
export interface TerminalIPCHandlers {
  'terminal:create': (cwd?: string) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  'terminal:write': (sessionId: string, data: string) => Promise<void>;
  'terminal:resize': (sessionId: string, cols: number, rows: number) => Promise<void>;
  'terminal:kill': (sessionId: string) => Promise<void>;
  'terminal:onData': (callback: (sessionId: string, data: string) => void) => void;
  'terminal:onExit': (callback: (sessionId: string, code: number) => void) => void;
}

export interface FileExplorerIPCHandlers {
  'files:readDirectory': (path: string) => Promise<FileNode[]>;
  'files:readFile': (path: string) => Promise<string>;
  'files:writeFile': (path: string, content: string) => Promise<void>;
  'files:createDirectory': (path: string) => Promise<void>;
  'files:delete': (path: string) => Promise<void>;
  'files:rename': (oldPath: string, newPath: string) => Promise<void>;
  'files:getFileInfo': (path: string) => Promise<FileNode>;
  'files:watch': (path: string) => Promise<void>;
  'files:unwatch': (path: string) => Promise<void>;
  'files:onChanged': (callback: (path: string, event: 'add' | 'change' | 'unlink') => void) => void;
}
