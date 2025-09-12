import { Globe } from 'lucide-react';
import React from 'react';

interface WebSearchToolProps {
  input: {
    query: string;
  };
}

export const WebSearchTool: React.FC<WebSearchToolProps> = ({ input }) => {
  return (
    <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Globe className="h-4 w-4 text-cyan-600" />
        <span className="text-sm font-medium text-cyan-700">Web Search</span>
      </div>
      <div className="rounded border border-cyan-100 bg-white p-2">
        <div className="mb-1 text-xs text-gray-500">Query:</div>
        <div className="text-sm font-medium text-gray-800">"{input.query}"</div>
      </div>
    </div>
  );
};
