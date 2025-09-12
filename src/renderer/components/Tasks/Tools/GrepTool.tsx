import React from 'react';

interface GrepToolProps {
  input: {
    pattern: string;
    output_mode?: string;
  };
}

export const GrepTool: React.FC<GrepToolProps> = ({ input }) => {
  return (
    <div className="my-2">
      <code className="text-muted-foreground font-mono text-xs">grep /{input.pattern}/</code>
    </div>
  );
};
