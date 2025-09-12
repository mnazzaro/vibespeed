import { Globe2 } from 'lucide-react';
import React from 'react';

interface WebFetchToolProps {
  input: {
    url: string;
    prompt?: string;
  };
}

export const WebFetchTool: React.FC<WebFetchToolProps> = ({ input }) => {
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Globe2 className="h-4 w-4 text-sky-600" />
        <span className="text-sm font-medium text-sky-700">Fetching Web Page</span>
      </div>
      <div className="space-y-2">
        <div className="rounded border border-sky-100 bg-white p-2">
          <div className="mb-1 text-xs text-gray-500">URL:</div>
          <a href={input.url} className="font-mono text-sm break-all text-sky-600 hover:underline">
            {input.url}
          </a>
        </div>
        {input.prompt && (
          <div className="rounded border border-sky-100 bg-white p-2">
            <div className="mb-1 text-xs text-gray-500">Prompt:</div>
            <div className="text-sm text-gray-700">{input.prompt}</div>
          </div>
        )}
      </div>
    </div>
  );
};
