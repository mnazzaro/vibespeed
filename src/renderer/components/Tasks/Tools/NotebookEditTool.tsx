import React, { useContext } from 'react';

import { ToolUsageProvider } from '@/renderer/components/Tasks/TaskChat';

import { getRelativePath } from './utils';

interface NotebookEditToolProps {
  input: {
    notebook_path: string;
    new_source?: string;
  };
}

export const NotebookEditTool: React.FC<NotebookEditToolProps> = ({ input }) => {
  const { workingDirectory } = useContext(ToolUsageProvider);
  const displayPath = getRelativePath(input.notebook_path, workingDirectory);
  return (
    <div className="my-2 font-mono text-xs">
      <div className="text-muted-foreground">{displayPath}</div>
      {input.new_source && (
        <pre className="overflow-x-auto pl-4 opacity-70">
          {input.new_source.substring(0, 100)}
          {input.new_source.length > 100 && '...'}
        </pre>
      )}
    </div>
  );
};
