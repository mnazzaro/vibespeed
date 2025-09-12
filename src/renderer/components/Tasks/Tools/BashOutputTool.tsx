import { Monitor } from 'lucide-react';
import React from 'react';

interface BashOutputToolProps {
  input: {
    bash_id: string;
  };
}

export const BashOutputTool: React.FC<BashOutputToolProps> = ({ input }) => {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-700">Getting Bash Output</span>
        <code className="rounded bg-blue-100 px-2 py-0.5 font-mono text-xs">Session: {input.bash_id}</code>
      </div>
    </div>
  );
};
