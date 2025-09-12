import { SDKMessage } from '@anthropic-ai/claude-code';
import { Bot } from 'lucide-react';
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

  console.log('TOOL STATES', toolStates);
  // Subscribe to activeTask from store for real-time updates
  const { activeTask, updateTask, addStreamingMessage, commitStreamingMessages, getMessagesForTask } = useTaskStore();

  // Use activeTask from store if available, otherwise fall back to prop
  const task = activeTask || propTask;

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

  // Listen for Claude streaming events
  useEffect(() => {
    const handleStreamEvent = (taskId: string, event: SDKMessage) => {
      if (taskId !== task.id) return;
      if (event.type === 'assistant') {
        console.log('ASSISTANT MESSAGE', event);
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

      // Add the streaming message to the store
      addStreamingMessage(taskId, event);

      if (event.type === 'result') {
        // Commit all streaming messages to persistent storage
        // and update sessionId if present
        commitStreamingMessages(taskId, event.session_id);

        setIsLoading(false);
      }
    };

    window.electronAPI.claude.onStreamEvent(handleStreamEvent);

    return () => {
      window.electronAPI.claude.removeClaudeListeners();
    };
  }, [task.id, addStreamingMessage, commitStreamingMessages]);

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const messageText = message.trim();
    setMessage('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = '44px';
    }
    setIsLoading(true);

    try {
      // Add the user message to streaming messages in the store
      console.log('Adding user message to store:', messageText);
      addStreamingMessage(task.id, messageText);

      // Then send to Claude for processing
      console.log('Sending message to Claude:', messageText);
      const response = await window.electronAPI.claude.sendMessage(task.id, messageText); // TODO: Add options
      console.log('Response from Claude:', response);
    } catch (error) {
      console.error('Failed to send message:', error); // TODO: Display to the user
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

  // Get all messages for this task (persisted + streaming)
  const allMessages = getMessagesForTask(task.id);
  console.log('ALL MESSAGES', allMessages);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6">
        {allMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Bot className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-medium">Start a conversation</h3>
            <p className="text-muted-foreground max-w-md text-sm">
              Describe what you want to build or ask questions about your code. Claude will help you with your task.
            </p>
          </div>
        ) : (
          <ToolUsageProvider.Provider value={{ toolStates, updateToolState }}>
            <TaskMessageStream messages={allMessages} />
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
