import { FolderSearch } from 'lucide-react';
import React from 'react';

interface GlobToolProps {
  input: {
    pattern: string;
  };
}

export const GlobTool: React.FC<GlobToolProps> = ({ input }) => {
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <FolderSearch className="h-4 w-4 text-teal-600" />
        <span className="text-sm font-medium text-teal-700">File Pattern Search</span>
      </div>
      <div className="overflow-x-auto rounded bg-gray-800 p-2 text-gray-100">
        <code className="font-mono text-sm text-yellow-300">{input.pattern}</code>
      </div>
    </div>
  );
};
