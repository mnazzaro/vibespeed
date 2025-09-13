import { Options } from '@anthropic-ai/claude-code';
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
  workingDirectory?: string;
}

export const ToolUsageProvider = createContext<ToolStateProviderProps>({
  toolStates: new Map(),
  updateToolState: () => {},
  workingDirectory: undefined,
});

export const TaskChat: React.FC<TaskChatProps> = ({ task: propTask }) => {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [toolStates, setToolStates] = useState<Map<string, ToolState>>(new Map());
  const updateToolState = React.useCallback((toolId: string, toolState: Partial<ToolState>) => {
    setToolStates((prev) => {
      const existing = prev.get(toolId);

      // Early return if no changes needed
      if (existing) {
        // Check each property individually to avoid JSON.stringify overhead
        let hasChanges = false;
        for (const key in toolState) {
          if (toolState[key as keyof ToolState] !== existing[key as keyof ToolState]) {
            hasChanges = true;
            break;
          }
        }

        // If no changes, return the same map reference
        if (!hasChanges) {
          return prev;
        }
      }

      // Only create new Map if something actually changed
      const newMap = new Map(prev);
      newMap.set(toolId, {
        ...existing,
        ...toolState,
      } as ToolState);
      return newMap;
    });
  }, []);

  // Subscribe to activeTask from store for real-time updates
  // Use selectors to minimize re-renders
  const activeTask = useTaskStore((state) => state.activeTask);
  const addMessage = useTaskStore((state) => state.addMessage);
  const setQueryActive = useTaskStore((state) => state.setQueryActive);

  // Use activeTask from store if available, otherwise fall back to prop
  const task = activeTask || propTask;

  // Get loading state from store - use a selector for just this task's query status
  const isLoading = useTaskStore((state) => state.activeQueries.has(task.id));

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
    // Reset the processed message count when task changes
    processedMessageCountRef.current = task.messages.length;
  }, [task.id]); // Only rebuild when task changes, not on every message

  // Handle new messages incrementally for tool states
  // Use a ref to track processed message count to avoid re-processing
  const processedMessageCountRef = useRef(0);

  useEffect(() => {
    const messageCount = task.messages.length;
    if (messageCount === 0 || messageCount <= processedMessageCountRef.current) return;

    // Only process new messages since last check
    const newMessages = task.messages.slice(processedMessageCountRef.current);

    for (const msg of newMessages) {
      if (typeof msg === 'string') continue;

      if (msg.type === 'assistant') {
        const assistantMsg = msg as any;
        if (assistantMsg.message?.content) {
          for (const content of assistantMsg.message.content) {
            if (content.type === 'tool_use') {
              updateToolState(content.id, {
                name: content.name,
                input: content.input,
                expanded: false,
              });
            }
          }
        }
      } else if (msg.type === 'user') {
        const userMsg = msg as any;
        if (userMsg.message?.content) {
          for (const content of userMsg.message.content) {
            if (content.type === 'tool_result') {
              updateToolState(content.tool_use_id, {
                content: content.content,
              });
            }
          }
        }
      }
    }

    processedMessageCountRef.current = messageCount;
  }, [task.messages.length, updateToolState]); // Process only when a new message is added

  const handleSend = async (options: Partial<Options>) => {
    if (!message.trim() || isLoading) return;

    const messageText = message.trim();
    setMessage('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = '44px';
    }

    try {
      // Mark query as active immediately for UI feedback
      setQueryActive(task.id, true);
      addMessage(task.id, messageText);
      await window.electronAPI.claude.sendMessage(task.id, messageText, options);
    } catch (error) {
      // On error, mark query as inactive
      setQueryActive(task.id, false);
      console.error('Failed to send message:', error);
    }
  };

  const handleCancelQuery = async () => {
    if (task.id) {
      try {
        await window.electronAPI.claude.cancelQuery(task.id);
        setQueryActive(task.id, false);
      } catch (error) {
        console.error('Failed to cancel query:', error); // TODO: Display to the user
      }
    }
  };

  // Memoize the context value to prevent re-renders
  const toolContextValue = React.useMemo(
    () => ({
      toolStates,
      updateToolState,
      workingDirectory: task.worktreeBasePath,
    }),
    [toolStates, updateToolState, task.worktreeBasePath]
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages area */}
      <div className="paper-texture flex-1 overflow-y-auto p-4">
        {task.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <h3 className="mb-3 font-serif text-2xl">What do you want to build?</h3>
          </div>
        ) : (
          <ToolUsageProvider.Provider value={toolContextValue}>
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
