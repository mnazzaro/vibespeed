import { Terminal } from 'lucide-react';
import React from 'react';

interface BashToolProps {
  input: {
    command: string;
    description?: string;
  };
}

export const BashTool: React.FC<BashToolProps> = ({ input }) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Terminal className="h-4 w-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">Bash Command</span>
      </div>
      <pre className="overflow-x-auto rounded bg-gray-900 p-2 text-gray-100">
        <code className="font-mono text-sm">{input.command}</code>
      </pre>
      {input.description && <p className="mt-2 text-xs text-gray-600 italic">{input.description}</p>}
    </div>
  );
};
