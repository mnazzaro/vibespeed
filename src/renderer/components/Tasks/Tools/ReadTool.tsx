import { BookOpen } from 'lucide-react';
import React from 'react';

interface ReadToolProps {
  input: {
    file_path: string;
  };
}

export const ReadTool: React.FC<ReadToolProps> = ({ input }) => {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-700">Reading File</span>
      </div>
      <div className="overflow-x-auto rounded border border-blue-100 bg-white p-2 font-mono text-xs">
        {input.file_path}
      </div>
    </div>
  );
};
