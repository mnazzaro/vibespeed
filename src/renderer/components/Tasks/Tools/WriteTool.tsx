import React, { useContext } from 'react';

import { ToolUsageProvider } from '@/renderer/components/Tasks/TaskChat';

import { getRelativePath } from './utils';

interface WriteToolProps {
  input: {
    file_path: string;
    content: string;
  };
}

export const WriteTool: React.FC<WriteToolProps> = ({ input }) => {
  const { workingDirectory } = useContext(ToolUsageProvider);
  const displayPath = getRelativePath(input.file_path, workingDirectory);
  const preview = input.content.substring(0, 100);

  return (
    <div className="my-2 font-mono text-xs">
      <div className="text-muted-foreground mb-1">{displayPath}</div>
      <pre className="overflow-x-auto pl-4 opacity-70">
        {preview}
        {input.content.length > 100 && '...'}
      </pre>
    </div>
  );
};
