import React, { useContext } from 'react';

import { ToolUsageProvider } from '@/renderer/components/Tasks/TaskChat';

import { getRelativePath } from './utils';

interface MultiEditToolProps {
  input: {
    file_path: string;
    edits: Array<{
      old_string: string;
      new_string: string;
    }>;
  };
}

export const MultiEditTool: React.FC<MultiEditToolProps> = ({ input }) => {
  const { workingDirectory } = useContext(ToolUsageProvider);
  const displayPath = getRelativePath(input.file_path, workingDirectory);
  return (
    <div className="my-2 font-mono text-xs">
      <div className="text-muted-foreground mb-1">
        Editing: {displayPath} <span className="opacity-70">({input.edits.length} edits)</span>
      </div>
      <div className="space-y-1 pl-4">
        {input.edits.slice(0, 3).map((edit, index) => (
          <div key={index} className="opacity-70">
            <span className="text-muted-foreground">{index + 1}.</span> {edit.old_string.substring(0, 30)}...
          </div>
        ))}
        {input.edits.length > 3 && <div className="text-muted-foreground">... {input.edits.length - 3} more</div>}
      </div>
    </div>
  );
};
