import React from 'react';

interface TaskToolProps {
  input: {
    subagent_type?: string;
    description: string;
    prompt: string;
  };
}

export const TaskTool: React.FC<TaskToolProps> = ({ input }) => {
  return (
    <div className="my-2 font-mono text-xs">
      <div className="text-muted-foreground">
        task: {input.description}
        {input.subagent_type && <span className="opacity-70"> [{input.subagent_type}]</span>}
      </div>
      <div className="pl-4 italic opacity-70">
        {input.prompt.substring(0, 100)}
        {input.prompt.length > 100 && '...'}
      </div>
    </div>
  );
};
