import { CheckSquare, Circle, CheckCircle, XCircle } from 'lucide-react';
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
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'in_progress':
        return <Circle className="h-3 w-3 animate-pulse text-blue-600" />;
      case 'cancelled':
        return <XCircle className="h-3 w-3 text-red-600" />;
      default:
        return <Circle className="h-3 w-3 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-700';
      case 'in_progress':
        return 'text-blue-700';
      case 'cancelled':
        return 'text-red-700';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-violet-600" />
        <span className="text-sm font-medium text-violet-700">Managing Todo List</span>
        <span className="rounded bg-violet-100 px-2 py-0.5 text-xs">
          {input.todos.length} {input.todos.length === 1 ? 'item' : 'items'}
        </span>
      </div>
      <div className="max-h-60 space-y-1 overflow-y-auto">
        {input.todos.map((todo, index) => (
          <div key={index} className="flex items-start gap-2 rounded border border-violet-100 bg-white p-2">
            {getStatusIcon(todo.status)}
            <div className="flex-1">
              <div className={`text-sm ${getStatusColor(todo.status)}`}>{todo.content}</div>
              {todo.activeForm && <div className="mt-0.5 text-xs text-gray-500 italic">{todo.activeForm}</div>}
            </div>
            <span className={`rounded bg-gray-100 px-1.5 py-0.5 text-xs ${getStatusColor(todo.status)}`}>
              {todo.status.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
