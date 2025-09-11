import { create } from 'zustand';

import { PaneConfig, PaneType, SavedLayout, TerminalSession, FileExplorerState } from '@/shared/types/panes';

interface PaneStore {
  // Configuration
  panes: PaneConfig[];
  activePane: string | null;
  layouts: SavedLayout[];
  currentLayout: string | null;

  // Terminal state
  terminalSessions: Record<string, TerminalSession>;

  // File Explorer state
  fileExplorerStates: Record<string, FileExplorerState>;

  // Actions - Pane Management
  addPane: (type: PaneType, position?: 'top' | 'bottom', metadata?: Record<string, any>) => string;
  removePane: (paneId: string) => void;
  togglePane: (paneId: string) => void;
  collapsePane: (paneId: string, collapsed: boolean) => void;
  resizePane: (paneId: string, size: number) => void;
  swapPanes: (paneId1: string, paneId2: string) => void;
  setActivePane: (paneId: string | null) => void;
  updatePaneMetadata: (paneId: string, metadata: Record<string, any>) => void;

  // Actions - Layout Management
  saveLayout: (name: string, description?: string) => void;
  loadLayout: (layoutId: string) => void;
  deleteLayout: (layoutId: string) => void;
  setDefaultLayout: (layoutId: string) => void;
  resetToDefaultLayout: () => void;

  // Actions - Terminal Management
  createTerminalSession: (paneId: string, sessionId: string, cwd: string) => void;
  updateTerminalSession: (sessionId: string, updates: Partial<TerminalSession>) => void;
  removeTerminalSession: (sessionId: string) => void;
  setActiveTerminalSession: (paneId: string, sessionId: string) => void;

  // Actions - File Explorer Management
  initFileExplorer: (paneId: string, rootPath: string) => void;
  updateFileExplorerState: (paneId: string, updates: Partial<FileExplorerState>) => void;
  toggleDirectory: (paneId: string, path: string) => void;
  selectFile: (paneId: string, path: string, multiSelect?: boolean) => void;
  clearSelection: (paneId: string) => void;

  // Utilities
  getPaneById: (paneId: string) => PaneConfig | undefined;
  getVisiblePanes: () => PaneConfig[];
  getTopPane: () => PaneConfig | undefined;
  getBottomPane: () => PaneConfig | undefined;
}

// Default layouts
const DEFAULT_LAYOUTS: SavedLayout[] = [
  {
    id: 'default-dev',
    name: 'Development',
    description: 'Standard development layout with file explorer and terminal',
    panes: [
      {
        id: 'file-explorer-1',
        type: PaneType.FILE_EXPLORER,
        position: 'top',
        size: 60,
        minSize: 20,
        maxSize: 80,
        visible: true,
        resizable: true,
        collapsible: true,
        title: 'Files',
      },
      {
        id: 'terminal-1',
        type: PaneType.TERMINAL,
        position: 'bottom',
        size: 40,
        minSize: 20,
        maxSize: 80,
        visible: true,
        resizable: true,
        collapsible: true,
        title: 'Terminal',
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
  },
];

export const usePaneStore = create<PaneStore>((set, get) => ({
  // Initial state
  panes: DEFAULT_LAYOUTS[0].panes,
  activePane: null,
  layouts: DEFAULT_LAYOUTS,
  currentLayout: 'default-dev',
  terminalSessions: {},
  fileExplorerStates: {},

  // Pane Management
  addPane: (type, position = 'bottom', metadata = {}) => {
    const id = `${type}-${Date.now()}`;
    const existingPanes = get().panes.filter((p) => p.position === position);
    const otherPanes = get().panes.filter((p) => p.position !== position);

    // Calculate size for new pane
    const newSize = 100 / (existingPanes.length + 1);
    const adjustedExistingPanes = existingPanes.map((pane) => ({
      ...pane,
      size: (100 - newSize) * (pane.size / 100),
    }));

    const newPane: PaneConfig = {
      id,
      type,
      position,
      size: newSize,
      minSize: 20,
      maxSize: 80,
      visible: true,
      resizable: true,
      collapsible: true,
      metadata,
    };

    set({
      panes: [...otherPanes, ...adjustedExistingPanes, newPane],
      activePane: id,
    });

    return id;
  },

  removePane: (paneId) => {
    const pane = get().getPaneById(paneId);
    if (!pane) return;

    const remainingPanes = get().panes.filter((p) => p.id !== paneId && p.position === pane.position);
    const otherPanes = get().panes.filter((p) => p.position !== pane.position);

    // Redistribute size among remaining panes in the same position
    const totalSize = remainingPanes.reduce((sum, p) => sum + p.size, 0) + pane.size;
    const adjustedPanes = remainingPanes.map((p) => ({
      ...p,
      size: (p.size / (totalSize - pane.size)) * 100,
    }));

    set({
      panes: [...otherPanes, ...adjustedPanes],
      activePane: get().activePane === paneId ? null : get().activePane,
    });

    // Clean up associated state
    if (pane.type === PaneType.TERMINAL) {
      const sessions = Object.values(get().terminalSessions).filter((s) => s.paneId === paneId);
      sessions.forEach((s) => get().removeTerminalSession(s.id));
    }

    if (pane.type === PaneType.FILE_EXPLORER) {
      const newStates = { ...get().fileExplorerStates };
      delete newStates[paneId];
      set({ fileExplorerStates: newStates });
    }
  },

  togglePane: (paneId) => {
    set({
      panes: get().panes.map((p) => (p.id === paneId ? { ...p, visible: !p.visible } : p)),
    });
  },

  collapsePane: (paneId, collapsed) => {
    set({
      panes: get().panes.map((p) => (p.id === paneId ? { ...p, collapsed } : p)),
    });
  },

  resizePane: (paneId, size) => {
    const pane = get().getPaneById(paneId);
    if (!pane) return;

    // Ensure size is within bounds
    const clampedSize = Math.max(pane.minSize, Math.min(pane.maxSize, size));

    // Get other panes in the same position
    const samePosPanes = get().panes.filter((p) => p.position === pane.position && p.id !== paneId);
    const otherPanes = get().panes.filter((p) => p.position !== pane.position);

    // Calculate remaining space and distribute proportionally
    const remainingSize = 100 - clampedSize;
    const currentOthersSize = samePosPanes.reduce((sum, p) => sum + p.size, 0);

    const adjustedPanes = samePosPanes.map((p) => ({
      ...p,
      size: currentOthersSize > 0 ? (p.size / currentOthersSize) * remainingSize : remainingSize / samePosPanes.length,
    }));

    set({
      panes: [...otherPanes, ...adjustedPanes, { ...pane, size: clampedSize }],
    });
  },

  swapPanes: (paneId1, paneId2) => {
    const pane1 = get().getPaneById(paneId1);
    const pane2 = get().getPaneById(paneId2);

    if (!pane1 || !pane2) return;

    set({
      panes: get().panes.map((p) => {
        if (p.id === paneId1) {
          return { ...pane1, position: pane2.position, size: pane2.size };
        }
        if (p.id === paneId2) {
          return { ...pane2, position: pane1.position, size: pane1.size };
        }
        return p;
      }),
    });
  },

  setActivePane: (paneId) => {
    set({ activePane: paneId });
  },

  updatePaneMetadata: (paneId, metadata) => {
    set({
      panes: get().panes.map((p) => (p.id === paneId ? { ...p, metadata: { ...p.metadata, ...metadata } } : p)),
    });
  },

  // Layout Management
  saveLayout: (name, description) => {
    const layout: SavedLayout = {
      id: `layout-${Date.now()}`,
      name,
      description,
      panes: get().panes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set({
      layouts: [...get().layouts, layout],
      currentLayout: layout.id,
    });
  },

  loadLayout: (layoutId) => {
    const layout = get().layouts.find((l) => l.id === layoutId);
    if (!layout) return;

    set({
      panes: layout.panes,
      currentLayout: layoutId,
      activePane: null,
    });
  },

  deleteLayout: (layoutId) => {
    // Can't delete default layouts
    const layout = get().layouts.find((l) => l.id === layoutId);
    if (layout?.isDefault) return;

    set({
      layouts: get().layouts.filter((l) => l.id !== layoutId),
      currentLayout: get().currentLayout === layoutId ? null : get().currentLayout,
    });
  },

  setDefaultLayout: (layoutId) => {
    set({
      layouts: get().layouts.map((l) => ({
        ...l,
        isDefault: l.id === layoutId,
      })),
    });
  },

  resetToDefaultLayout: () => {
    const defaultLayout = get().layouts.find((l) => l.isDefault) || DEFAULT_LAYOUTS[0];
    get().loadLayout(defaultLayout.id);
  },

  // Terminal Management
  createTerminalSession: (paneId, sessionId, cwd) => {
    const session: TerminalSession = {
      id: sessionId,
      paneId,
      title: `Terminal ${Object.keys(get().terminalSessions).length + 1}`,
      cwd,
      isActive: true,
      buffer: [],
    };

    // Set other sessions in this pane to inactive
    const updatedSessions = Object.fromEntries(
      Object.entries(get().terminalSessions).map(([id, s]) => [id, s.paneId === paneId ? { ...s, isActive: false } : s])
    );

    set({
      terminalSessions: {
        ...updatedSessions,
        [sessionId]: session,
      },
    });
  },

  updateTerminalSession: (sessionId, updates) => {
    set({
      terminalSessions: {
        ...get().terminalSessions,
        [sessionId]: {
          ...get().terminalSessions[sessionId],
          ...updates,
        },
      },
    });
  },

  removeTerminalSession: (sessionId) => {
    const { [sessionId]: _removed, ...rest } = get().terminalSessions;
    set({ terminalSessions: rest });
  },

  setActiveTerminalSession: (paneId, sessionId) => {
    set({
      terminalSessions: Object.fromEntries(
        Object.entries(get().terminalSessions).map(([id, session]) => [
          id,
          {
            ...session,
            isActive: session.paneId === paneId ? id === sessionId : session.isActive,
          },
        ])
      ),
    });
  },

  // File Explorer Management
  initFileExplorer: (paneId, rootPath) => {
    const state: FileExplorerState = {
      rootPath,
      currentPath: rootPath,
      selectedFiles: [],
      expandedDirectories: new Set([rootPath]),
      showHiddenFiles: false,
      sortBy: 'name',
      sortOrder: 'asc',
    };

    set({
      fileExplorerStates: {
        ...get().fileExplorerStates,
        [paneId]: state,
      },
    });
  },

  updateFileExplorerState: (paneId, updates) => {
    const currentState = get().fileExplorerStates[paneId];
    if (!currentState) return;

    set({
      fileExplorerStates: {
        ...get().fileExplorerStates,
        [paneId]: {
          ...currentState,
          ...updates,
        },
      },
    });
  },

  toggleDirectory: (paneId, path) => {
    const state = get().fileExplorerStates[paneId];
    if (!state) return;

    const expanded = new Set(state.expandedDirectories);
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }

    get().updateFileExplorerState(paneId, { expandedDirectories: expanded });
  },

  selectFile: (paneId, path, multiSelect = false) => {
    const state = get().fileExplorerStates[paneId];
    if (!state) return;

    let selectedFiles: string[];
    if (multiSelect) {
      if (state.selectedFiles.includes(path)) {
        selectedFiles = state.selectedFiles.filter((f) => f !== path);
      } else {
        selectedFiles = [...state.selectedFiles, path];
      }
    } else {
      selectedFiles = [path];
    }

    get().updateFileExplorerState(paneId, { selectedFiles });
  },

  clearSelection: (paneId) => {
    get().updateFileExplorerState(paneId, { selectedFiles: [] });
  },

  // Utilities
  getPaneById: (paneId) => {
    return get().panes.find((p) => p.id === paneId);
  },

  getVisiblePanes: () => {
    return get().panes.filter((p) => p.visible);
  },

  getTopPane: () => {
    return get().panes.find((p) => p.position === 'top' && p.visible);
  },

  getBottomPane: () => {
    return get().panes.find((p) => p.position === 'bottom' && p.visible);
  },
}));
