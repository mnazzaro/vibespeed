import React from 'react';

interface WebFetchToolProps {
  input: {
    url: string;
    prompt?: string;
  };
}

export const WebFetchTool: React.FC<WebFetchToolProps> = ({ input }) => {
  return (
    <div className="my-2 font-mono text-xs">
      <div className="text-muted-foreground break-all">fetch: {input.url}</div>
      {input.prompt && (
        <div className="pl-4 italic opacity-70">
          {input.prompt.substring(0, 80)}
          {input.prompt.length > 80 && '...'}
        </div>
      )}
    </div>
  );
};
