import React from 'react';

import { MarkdownContent } from '@/renderer/components/Tasks/TaskMessageStream';

interface ExitPlanModeToolProps {
  input: {
    plan: string;
  };
}

export const ExitPlanModeTool: React.FC<ExitPlanModeToolProps> = ({ input }) => {
  return (
    <div className="my-2">
      <MarkdownContent content={input.plan} />
    </div>
  );
};
