import React from 'react';

interface BashOutputToolProps {
  input: {
    bash_id: string;
  };
}

export const BashOutputTool: React.FC<BashOutputToolProps> = ({ input }) => {
  return (
    <div className="my-2">
      <span className="text-muted-foreground font-mono text-xs">output: {input.bash_id}</span>
    </div>
  );
};
