import { XCircle } from 'lucide-react';
import React from 'react';

interface KillBashToolProps {
  input: {
    shell_id: string;
  };
}

export const KillBashTool: React.FC<KillBashToolProps> = ({ input }) => {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-red-600" />
        <span className="text-sm font-medium text-red-700">Terminating Bash Session</span>
        <code className="rounded bg-red-100 px-2 py-0.5 font-mono text-xs">{input.shell_id}</code>
      </div>
    </div>
  );
};
