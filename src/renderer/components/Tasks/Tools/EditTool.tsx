import React from 'react';

interface EditToolProps {
  input: {
    file_path: string;
    old_string: string;
    new_string: string;
  };
}

export const EditTool: React.FC<EditToolProps> = ({ input }) => {
  return (
    <div className="my-2 font-mono text-xs">
      <div className="text-muted-foreground mb-1">{input.file_path}</div>
      <div className="space-y-1 pl-4">
        <div className="overflow-x-auto">
          <span className="text-muted-foreground">- </span>
          <span className="opacity-70">
            {input.old_string.substring(0, 100)}
            {input.old_string.length > 100 && '...'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <span className="text-muted-foreground">+ </span>
          {input.new_string.substring(0, 100)}
          {input.new_string.length > 100 && '...'}
        </div>
      </div>
    </div>
  );
};
