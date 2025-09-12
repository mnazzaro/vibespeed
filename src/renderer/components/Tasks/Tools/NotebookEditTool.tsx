import { Notebook } from 'lucide-react';
import React from 'react';

interface NotebookEditToolProps {
  input: {
    notebook_path: string;
    new_source?: string;
  };
}

export const NotebookEditTool: React.FC<NotebookEditToolProps> = ({ input }) => {
  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Notebook className="h-4 w-4 text-orange-600" />
        <span className="text-sm font-medium text-orange-700">Editing Notebook</span>
      </div>
      <div className="space-y-2">
        <div className="overflow-x-auto rounded border border-orange-100 bg-white p-2 font-mono text-xs">
          {input.notebook_path}
        </div>
        {input.new_source && (
          <div className="overflow-x-auto rounded bg-gray-900 p-2 text-gray-100">
            <pre className="font-mono text-xs">
              <code className="language-python">
                {input.new_source.substring(0, 100)}
                {input.new_source.length > 100 && '...'}
              </code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
