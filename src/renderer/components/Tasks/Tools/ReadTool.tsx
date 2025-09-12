import React from 'react';

interface ReadToolProps {
  input: {
    file_path: string;
  };
}

export const ReadTool: React.FC<ReadToolProps> = ({ input }) => {
  return (
    <div className="my-2">
      <span className="text-muted-foreground font-mono text-xs">{input.file_path}</span>
    </div>
  );
};
