import React, { useState, useCallback, useEffect } from 'react';

import { cn } from '@/lib/utils';

interface PaneResizerProps {
  orientation: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  className?: string;
}

export const PaneResizer: React.FC<PaneResizerProps> = ({ orientation, onResize, className }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      setStartPos(orientation === 'horizontal' ? e.clientY : e.clientX);
    },
    [orientation]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const currentPos = orientation === 'horizontal' ? e.clientY : e.clientX;
      const delta = currentPos - startPos;

      if (Math.abs(delta) > 0) {
        onResize(delta);
        setStartPos(currentPos);
      }
    },
    [isDragging, startPos, orientation, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = orientation === 'horizontal' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, orientation]);

  const handleDoubleClick = () => {
    // Reset to default size
    onResize(0);
  };

  return (
    <div
      className={cn(
        'group relative z-20 flex items-center justify-center',
        orientation === 'horizontal' ? 'h-1 w-full cursor-row-resize' : 'h-full w-1 cursor-col-resize',
        isDragging && 'bg-primary/20',
        className
      )}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Visual indicator */}
      <div
        className={cn(
          'transition-colors',
          orientation === 'horizontal' ? 'hover:bg-primary/10 h-full w-full' : 'hover:bg-primary/10 h-full w-full',
          isDragging && 'bg-primary/20'
        )}
      />

      {/* Drag handle */}
      <div
        className={cn(
          'bg-muted-foreground/20 absolute rounded-full transition-all',
          orientation === 'horizontal'
            ? 'group-hover:bg-primary/30 h-1 w-12 group-hover:h-1.5'
            : 'group-hover:bg-primary/30 h-12 w-1 group-hover:w-1.5',
          isDragging && 'bg-primary/50'
        )}
      />

      {/* Invisible expand area for easier grabbing */}
      <div className={cn('absolute', orientation === 'horizontal' ? 'inset-x-0 -inset-y-1' : '-inset-x-1 inset-y-0')} />
    </div>
  );
};
