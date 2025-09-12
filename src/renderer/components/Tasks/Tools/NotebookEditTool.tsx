import React from 'react';

interface NotebookEditToolProps {
  input: {
    notebook_path: string;
    new_source?: string;
  };
}

export const NotebookEditTool: React.FC<NotebookEditToolProps> = ({ input }) => {
  return (
    <div className="my-2 font-mono text-xs">
      <div className="text-muted-foreground">{input.notebook_path}</div>
      {input.new_source && (
        <pre className="overflow-x-auto pl-4 opacity-70">
          {input.new_source.substring(0, 100)}
          {input.new_source.length > 100 && '...'}
        </pre>
      )}
    </div>
  );
};
