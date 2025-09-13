import React, { useContext } from 'react';

import { ToolUsageProvider } from '@/renderer/components/Tasks/TaskChat';

import { getRelativePath } from './utils';

interface ReadToolProps {
  input: {
    file_path: string;
  };
}

export const ReadTool: React.FC<ReadToolProps> = ({ input }) => {
  const { workingDirectory } = useContext(ToolUsageProvider);
  const displayPath = getRelativePath(input.file_path, workingDirectory);

  return (
    <div className="my-2">
      <span className="text-muted-foreground font-mono text-xs">Reading: {displayPath}</span>
    </div>
  );
};
