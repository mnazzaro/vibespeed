import { Search } from 'lucide-react';
import React from 'react';

interface GrepToolProps {
  input: {
    pattern: string;
    output_mode?: string;
  };
}

export const GrepTool: React.FC<GrepToolProps> = ({ input }) => {
  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Search className="h-4 w-4 text-indigo-600" />
        <span className="text-sm font-medium text-indigo-700">Searching with Grep</span>
        {input.output_mode && <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs">{input.output_mode}</span>}
      </div>
      <div className="overflow-x-auto rounded bg-gray-900 p-2 text-gray-100">
        <code className="font-mono text-sm text-orange-300">/{input.pattern}/</code>
      </div>
    </div>
  );
};
