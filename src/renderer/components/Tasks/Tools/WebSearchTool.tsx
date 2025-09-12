import React from 'react';

interface WebSearchToolProps {
  input: {
    query: string;
  };
}

export const WebSearchTool: React.FC<WebSearchToolProps> = ({ input }) => {
  return (
    <div className="my-2">
      <span className="text-muted-foreground font-mono text-xs">search: "{input.query}"</span>
    </div>
  );
};
