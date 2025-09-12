import React from 'react';

interface ExitPlanModeToolProps {
  input: {
    plan: string;
  };
}

export const ExitPlanModeTool: React.FC<ExitPlanModeToolProps> = ({ input }) => {
  return (
    <div className="my-2">
      <div className="text-muted-foreground font-mono text-xs">plan:</div>
      <div className="pl-4 text-xs whitespace-pre-wrap opacity-70">{input.plan}</div>
    </div>
  );
};
