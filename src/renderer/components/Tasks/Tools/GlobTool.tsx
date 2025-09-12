import React from 'react';

interface GlobToolProps {
  input: {
    pattern: string;
  };
}

export const GlobTool: React.FC<GlobToolProps> = ({ input }) => {
  return (
    <div className="my-2">
      <code className="text-muted-foreground font-mono text-xs">glob {input.pattern}</code>
    </div>
  );
};
