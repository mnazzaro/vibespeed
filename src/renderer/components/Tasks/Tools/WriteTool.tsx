import { FileText } from 'lucide-react';
import React from 'react';

interface WriteToolProps {
  input: {
    file_path: string;
    content: string;
  };
}

export const WriteTool: React.FC<WriteToolProps> = ({ input }) => {
  const preview = input.content.substring(0, 150);

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <FileText className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium text-green-700">Writing File</span>
      </div>
      <div className="space-y-2">
        <div className="overflow-x-auto rounded border border-green-100 bg-white p-2 font-mono text-xs">
          {input.file_path}
        </div>
        <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs">
          <div className="mb-1 text-gray-500">Content preview:</div>
          <pre className="font-mono break-words whitespace-pre-wrap text-gray-700">
            {preview}
            {input.content.length > 150 && '...'}
          </pre>
        </div>
      </div>
    </div>
  );
};
