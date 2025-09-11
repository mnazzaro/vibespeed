import { X, ChevronDown, ChevronUp } from 'lucide-react';
import React, { lazy, Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePaneStore } from '@/renderer/store/panes';
import { PaneConfig, PaneType } from '@/shared/types/panes';

// Lazy load pane components for better performance
const FileExplorerPane = lazy(() => import('../PaneTypes/FileExplorerPane'));
const TerminalPane = lazy(() => import('../PaneTypes/TerminalPane'));

interface PaneWrapperProps {
  pane: PaneConfig;
}

export const PaneWrapper: React.FC<PaneWrapperProps> = ({ pane }) => {
  const { activePane, setActivePane, removePane, collapsePane } = usePaneStore();

  const isActive = activePane === pane.id;

  const handleClose = () => {
    if (confirm('Are you sure you want to close this pane?')) {
      removePane(pane.id);
    }
  };

  const handleCollapse = () => {
    collapsePane(pane.id, !pane.collapsed);
  };

  const renderPaneContent = () => {
    switch (pane.type) {
      case PaneType.FILE_EXPLORER:
        return <FileExplorerPane paneId={pane.id} config={pane} isActive={isActive} />;
      case PaneType.TERMINAL:
        return <TerminalPane paneId={pane.id} config={pane} isActive={isActive} />;
      default:
        return (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">{pane.type} pane not implemented yet</p>
          </div>
        );
    }
  };

  const getPaneIcon = () => {
    switch (pane.type) {
      case PaneType.FILE_EXPLORER:
        return (
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3h-5.379a.25.25 0 01-.177-.073L7.177 1.41A1.75 1.75 0 005.95 1H1.75z" />
          </svg>
        );
      case PaneType.TERMINAL:
        return (
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.75 2.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25H1.75zM0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm4.091 3.79l2.17 2.17a.75.75 0 010 1.06l-2.17 2.17a.75.75 0 11-1.061-1.061L4.67 9.25 3.03 7.61a.75.75 0 111.061-1.061zM8.75 9.5a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden border-b',
        isActive && 'ring-primary/20 ring-1',
        pane.collapsed && 'flex-none'
      )}
      style={{
        height: pane.collapsed ? 'auto' : '100%',
        flex: pane.collapsed ? '0 0 auto' : '1 1 0%',
      }}
      onClick={() => setActivePane(pane.id)}
    >
      {/* Pane Header */}
      <div className="bg-muted/10 flex h-9 items-center justify-between border-b px-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{getPaneIcon()}</span>
          <span className="text-sm font-medium">{pane.title || pane.type}</span>
          {pane.metadata?.badge && (
            <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs">{pane.metadata.badge}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {pane.collapsible && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                handleCollapse();
              }}
            >
              {pane.collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-destructive/10 hover:text-destructive h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Pane Content */}
      {!pane.collapsed && (
        <div className="flex-1 overflow-hidden">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="border-primary mb-2 h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                  <p className="text-muted-foreground text-xs">Loading pane...</p>
                </div>
              </div>
            }
          >
            {renderPaneContent()}
          </Suspense>
        </div>
      )}
    </div>
  );
};
