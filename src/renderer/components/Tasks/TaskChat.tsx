import { Options, SDKMessage } from '@anthropic-ai/claude-code';
import React, { useState, useRef, useEffect, createContext } from 'react';

import { TaskInput } from '@/renderer/components/Tasks/TaskInput';
import { TaskMessageStream } from '@/renderer/components/Tasks/TaskMessageStream';
import { useTaskStore } from '@/renderer/store/tasks';
import { Task } from '@/shared/types/tasks';

interface TaskChatProps {
  task: Task;
}

export interface ToolState {
  name:
    | 'Read'
    | 'Write'
    | 'Edit'
    | 'MultiEdit'
    | 'Bash'
    | 'BashOutput'
    | 'KillBash'
    | 'Grep'
    | 'Glob'
    | 'WebSearch'
    | 'WebFetch'
    | 'Task'
    | 'TodoWrite'
    | 'NotebookEdit'
    | 'ExitPlanMode';
  input: any;
  content?: string;
  expanded: boolean;
}

export interface ToolStateProviderProps {
  toolStates: Map<string, ToolState>;
  updateToolState: (toolId: string, toolState: Partial<ToolState>) => void;
}

export const ToolUsageProvider = createContext<ToolStateProviderProps>({
  toolStates: new Map(),
  updateToolState: () => {},
});

export const TaskChat: React.FC<TaskChatProps> = ({ task: propTask }) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [toolStates, setToolStates] = useState<Map<string, ToolState>>(new Map());
  const updateToolState = (toolId: string, toolState: Partial<ToolState>) => {
    setToolStates((prev) => {
      const newMap = new Map(prev);
      newMap.set(toolId, { ...(newMap.get(toolId) || {}), ...toolState } as ToolState);
      return newMap;
    });
  };

  // Subscribe to activeTask from store for real-time updates
  const { activeTask, updateTask, addMessage, updateSessionId } = useTaskStore();

  // Use activeTask from store if available, otherwise fall back to prop
  const task = activeTask || propTask;

  // Initialize tool states from existing messages on mount or when task changes
  useEffect(() => {
    const newToolStates = new Map<string, ToolState>();

    // Iterate through all messages to rebuild tool states
    for (const msg of task.messages) {
      if (typeof msg === 'string') continue;

      if (msg.type === 'assistant') {
        const assistantMsg = msg as any; // Type assertion for simplicity
        if (assistantMsg.message?.content) {
          for (const content of assistantMsg.message.content) {
            if (content.type === 'tool_use') {
              newToolStates.set(content.id, {
                name: content.name,
                input: content.input,
                expanded: false,
                content: undefined,
              });
            }
          }
        }
      } else if (msg.type === 'user') {
        const userMsg = msg as any;
        if (userMsg.message?.content) {
          for (const content of userMsg.message.content) {
            if (content.type === 'tool_result') {
              const existingState = newToolStates.get(content.tool_use_id);
              if (existingState) {
                existingState.content = content.content;
              }
            }
          }
        }
      }
    }

    setToolStates(newToolStates);
  }, [task.id, task.messages.length]); // Re-run when task changes or messages are added

  // Listen for task updates from main process
  useEffect(() => {
    const handleTaskUpdated = (taskId: string, updatedTask: Task) => {
      if (taskId === task.id) {
        updateTask(taskId, updatedTask);
      }
    };

    window.electronAPI.tasks.onTaskUpdated(handleTaskUpdated);

    return () => {
      window.electronAPI.tasks.removeTaskListeners();
    };
  }, [task.id, updateTask]);

  useEffect(() => {
    const handleStreamEvent = (taskId: string, event: SDKMessage) => {
      if (taskId !== task.id) return;

      addMessage(taskId, event);

      if (event.type === 'assistant') {
        for (const content of event.message.content) {
          if (content.type === 'tool_use') {
            updateToolState(content.id, {
              name: content.name,
              input: content.input,
              expanded: false,
            });
          }
        }
      } else if (event.type === 'user') {
        for (const content of event.message.content) {
          if (content.type === 'tool_result') {
            updateToolState(content.tool_use_id, {
              content: content.content,
            });
          }
        }
      }

      if (event.type === 'result') {
        if (event.session_id) {
          updateSessionId(taskId, event.session_id);
        }
        setIsLoading(false);
      }
    };

    window.electronAPI.claude.onStreamEvent(handleStreamEvent);

    return () => {
      window.electronAPI.claude.removeClaudeListeners();
    };
  }, [task.id, addMessage, updateSessionId]);

  const handleSend = async (options: Partial<Options>) => {
    if (!message.trim() || isLoading) return;

    const messageText = message.trim();
    setMessage('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = '44px';
    }
    setIsLoading(true);

    try {
      addMessage(task.id, messageText);
      await window.electronAPI.claude.sendMessage(task.id, messageText, options);
    } catch {
      setIsLoading(false);
    }
  };

  const handleCancelQuery = async () => {
    if (task.id) {
      try {
        await window.electronAPI.claude.cancelQuery(task.id);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to cancel query:', error); // TODO: Display to the user
      }
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages area */}
      <div className="paper-texture flex-1 overflow-y-auto p-4">
        {task.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <h3 className="mb-3 font-serif text-2xl">What do you want to build?</h3>
          </div>
        ) : (
          <ToolUsageProvider.Provider value={{ toolStates, updateToolState }}>
            <TaskMessageStream messages={task.messages} />
          </ToolUsageProvider.Provider>
        )}
      </div>

      <TaskInput
        value={message}
        onChange={setMessage}
        onSend={handleSend}
        onCancel={handleCancelQuery}
        isLoading={isLoading}
        canCancel={true}
      />
    </div>
  );
};
