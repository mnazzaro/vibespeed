import React from 'react';

interface TodoWriteToolProps {
  input: {
    todos: Array<{
      content: string;
      status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
      activeForm?: string;
    }>;
  };
}

export const TodoWriteTool: React.FC<TodoWriteToolProps> = ({ input }) => {
  const getStatusSymbol = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'in_progress':
        return '•';
      case 'cancelled':
        return '×';
      default:
        return '○';
    }
  };

  return (
    <div className="my-2 font-mono text-xs">
      <div className="text-muted-foreground mb-1">Tasks ({input.todos.length})</div>
      <div className="space-y-0.5 pl-4">
        {input.todos.map((todo, index) => (
          <div key={index} className="flex gap-2">
            <span className="text-muted-foreground">{getStatusSymbol(todo.status)}</span>
            <span className={todo.status === 'completed' ? 'line-through opacity-50' : ''}>{todo.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
