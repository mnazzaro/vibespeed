import { X, ChevronDown, ChevronUp } from 'lucide-react';
import React, { lazy, Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePaneStore } from '@/renderer/store/panes';
import { PaneConfig, PaneType } from '@/shared/types/panes';

// Lazy load pane components for better performance
const FileExplorerPane = lazy(() => import('../PaneTypes/FileExplorerPane'));
const TerminalPane = lazy(() => import('../PaneTypes/TerminalPane'));
const GitDiffPane = lazy(() => import('../PaneTypes/GitDiffPane'));

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
      case PaneType.GIT_DIFF:
        return <GitDiffPane paneId={pane.id} config={pane} isActive={isActive} />;
      default:
        return (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">{pane.type} pane not implemented yet</p>
          </div>
        );
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
          <span className="text-sm font-semibold">{pane.title || pane.type}</span>
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
