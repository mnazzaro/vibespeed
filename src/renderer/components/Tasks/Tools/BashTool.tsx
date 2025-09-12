import React from 'react';

interface BashToolProps {
  input: {
    command: string;
    description?: string;
  };
}

export const BashTool: React.FC<BashToolProps> = ({ input }) => {
  return (
    <div className="my-2">
      <pre className="overflow-x-auto">
        <code className="text-muted-foreground font-mono text-sm">$ {input.command}</code>
      </pre>
    </div>
  );
};
