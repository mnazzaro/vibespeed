import { Flag } from 'lucide-react';
import React from 'react';

interface ExitPlanModeToolProps {
  input: {
    plan: string;
  };
}

export const ExitPlanModeTool: React.FC<ExitPlanModeToolProps> = ({ input }) => {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Flag className="h-4 w-4 text-emerald-600" />
        <span className="text-sm font-medium text-emerald-700">Exiting Plan Mode</span>
      </div>
      <div className="rounded border border-emerald-100 bg-white p-2">
        <div className="mb-1 text-xs text-gray-500">Plan Summary:</div>
        <div className="text-sm whitespace-pre-wrap text-gray-700">{input.plan}</div>
      </div>
    </div>
  );
};
