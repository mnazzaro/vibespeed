import { FileEdit } from 'lucide-react';
import React from 'react';

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
  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <FileEdit className="h-4 w-4 text-purple-600" />
        <span className="text-sm font-medium text-purple-700">Multi-Edit File</span>
        <span className="rounded bg-purple-100 px-2 py-0.5 text-xs">{input.edits.length} edits</span>
      </div>
      <div className="mb-2 rounded border border-purple-100 bg-white p-2 font-mono text-xs">{input.file_path}</div>
      <div className="max-h-40 space-y-2 overflow-y-auto">
        {input.edits.map((edit, index) => (
          <div key={index} className="border-l-2 border-purple-300 pl-2 text-xs">
            <div className="font-semibold text-purple-600">Edit {index + 1}:</div>
            <div className="mt-1 overflow-x-auto rounded bg-red-50 p-1 font-mono text-red-600">
              - {edit.old_string.substring(0, 50)}
              {edit.old_string.length > 50 && '...'}
            </div>
            <div className="mt-1 overflow-x-auto rounded bg-green-50 p-1 font-mono text-green-600">
              + {edit.new_string.substring(0, 50)}
              {edit.new_string.length > 50 && '...'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
