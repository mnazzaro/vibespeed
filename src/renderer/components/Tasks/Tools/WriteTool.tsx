import React from 'react';

interface WriteToolProps {
  input: {
    file_path: string;
    content: string;
  };
}

export const WriteTool: React.FC<WriteToolProps> = ({ input }) => {
  const preview = input.content.substring(0, 100);

  return (
    <div className="my-2 font-mono text-xs">
      <div className="text-muted-foreground mb-1">{input.file_path}</div>
      <pre className="overflow-x-auto pl-4 opacity-70">
        {preview}
        {input.content.length > 100 && '...'}
      </pre>
    </div>
  );
};
