import { FileEdit } from 'lucide-react';
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
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <FileEdit className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium text-amber-700">Editing File</span>
      </div>
      <div className="space-y-2">
        <div className="rounded border border-amber-100 bg-white p-2 font-mono text-xs">{input.file_path}</div>
        <div className="space-y-1">
          <div className="overflow-x-auto rounded bg-red-50 p-2 font-mono text-xs text-red-600">
            <span className="text-red-400">- </span>
            {input.old_string.substring(0, 100)}
            {input.old_string.length > 100 && '...'}
          </div>
          <div className="overflow-x-auto rounded bg-green-50 p-2 font-mono text-xs text-green-600">
            <span className="text-green-400">+ </span>
            {input.new_string.substring(0, 100)}
            {input.new_string.length > 100 && '...'}
          </div>
        </div>
      </div>
    </div>
  );
};
