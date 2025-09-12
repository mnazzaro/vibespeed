import { ListTodo } from 'lucide-react';
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
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <ListTodo className="h-4 w-4 text-rose-600" />
        <span className="text-sm font-medium text-rose-700">Creating Subtask</span>
        {input.subagent_type && <span className="rounded bg-rose-100 px-2 py-0.5 text-xs">{input.subagent_type}</span>}
      </div>
      <div className="space-y-2">
        <div className="rounded border border-rose-100 bg-white p-2">
          <div className="mb-1 text-xs text-gray-500">Description:</div>
          <div className="text-sm text-gray-700">{input.description}</div>
        </div>
        <div className="rounded border border-rose-100 bg-white p-2">
          <div className="mb-1 text-xs text-gray-500">Prompt:</div>
          <div className="text-sm text-gray-700 italic">{input.prompt}</div>
        </div>
      </div>
    </div>
  );
};
