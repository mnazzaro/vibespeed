import React from 'react';

interface KillBashToolProps {
  input: {
    shell_id: string;
  };
}

export const KillBashTool: React.FC<KillBashToolProps> = ({ input }) => {
  return (
    <div className="my-2">
      <span className="text-muted-foreground font-mono text-xs">kill: {input.shell_id}</span>
    </div>
  );
};
