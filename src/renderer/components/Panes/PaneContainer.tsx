import React, { useEffect, useRef } from 'react';

import { usePaneStore } from '@/renderer/store/panes';

import { PaneResizer } from './PaneResizer';
import { PaneWrapper } from './PaneWrapper';

export const PaneContainer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { getVisiblePanes, resizePane } = usePaneStore();

  const visiblePanes = getVisiblePanes();
  const topPanes = visiblePanes.filter((p) => p.position === 'top');
  const bottomPanes = visiblePanes.filter((p) => p.position === 'bottom');

  const handleResize = (position: 'top' | 'bottom', delta: number) => {
    if (!containerRef.current) return;

    const containerHeight = containerRef.current.offsetHeight;
    const deltaPercent = (delta / containerHeight) * 100;

    // Adjust sizes of top and bottom panes
    if (topPanes.length > 0 && bottomPanes.length > 0) {
      const topPane = topPanes[0];
      const bottomPane = bottomPanes[0];

      const newTopSize = topPane.size + deltaPercent;
      const newBottomSize = bottomPane.size - deltaPercent;

      // Check if both new sizes are within bounds
      if (
        newTopSize >= topPane.minSize &&
        newTopSize <= topPane.maxSize &&
        newBottomSize >= bottomPane.minSize &&
        newBottomSize <= bottomPane.maxSize
      ) {
        resizePane(topPane.id, newTopSize);
        resizePane(bottomPane.id, newBottomSize);
      }
    }
  };

  // Handle keyboard shortcuts for pane management
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + W to toggle panes
      if (e.altKey && e.key === 'w') {
        e.preventDefault();
        // Toggle functionality can be added here
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (visiblePanes.length === 0) {
    return (
      <div className="bg-muted/5 flex h-full w-full items-center justify-center border-l">
        <div className="text-center">
          <p className="text-muted-foreground text-sm">No panes open</p>
          <p className="text-muted-foreground mt-1 text-xs">Use the View menu to add panes</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-background flex h-full w-full flex-col border-l">
      {/* Top Panes */}
      {topPanes.length > 0 && (
        <div className="flex flex-col" style={{ height: `${topPanes[0].size}%` }}>
          {topPanes.map((pane, index) => (
            <React.Fragment key={pane.id}>
              <PaneWrapper pane={pane} />
              {index < topPanes.length - 1 && (
                <PaneResizer
                  orientation="horizontal"
                  onResize={() => {
                    // TODO: Handle resize between multiple top panes if needed
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Resizer between top and bottom */}
      {topPanes.length > 0 && bottomPanes.length > 0 && (
        <PaneResizer orientation="horizontal" onResize={(delta) => handleResize('top', delta)} />
      )}

      {/* Bottom Panes */}
      {bottomPanes.length > 0 && (
        <div
          className="flex flex-col"
          style={{
            height: topPanes.length > 0 ? `${bottomPanes[0].size}%` : '100%',
          }}
        >
          {bottomPanes.map((pane, index) => (
            <React.Fragment key={pane.id}>
              <PaneWrapper pane={pane} />
              {index < bottomPanes.length - 1 && (
                <PaneResizer
                  orientation="horizontal"
                  onResize={() => {
                    // TODO: Handle resize between multiple bottom panes if needed
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
