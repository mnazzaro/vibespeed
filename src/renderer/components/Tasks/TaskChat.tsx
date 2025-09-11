import {
  Send,
  User,
  Bot,
  Loader2,
  FileText,
  Terminal,
  Search,
  Globe,
  FolderSearch,
  FilePlus,
  FileEdit,
  Notebook,
  Monitor,
  XCircle,
  ListTodo,
  CheckSquare,
  Flag,
  Wrench,
  Globe2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/renderer/store/tasks';
import { ClaudeStreamEvent, TOOL_ICON_MAP } from '@/shared/types/claude';
import { Task } from '@/shared/types/tasks';

interface TaskChatProps {
  task: Task;
}

interface StreamingMessage {
  id: string;
  content: string;
  isStreaming: boolean;
  events: EventInfo[];
}

interface EventInfo {
  id: string;
  type: 'tool_use' | 'status' | 'error';
  toolName?: string;
  description?: string;
  status?: 'started' | 'completed' | 'failed';
  timestamp: Date;
}

const getIconForTool = (toolName: string): React.ReactNode => {
  const iconName = TOOL_ICON_MAP[toolName] || TOOL_ICON_MAP.default;

  const iconMap: Record<string, React.ReactNode> = {
    FileText: <FileText className="h-4 w-4" />,
    FilePlus: <FilePlus className="h-4 w-4" />,
    FileEdit: <FileEdit className="h-4 w-4" />,
    Notebook: <Notebook className="h-4 w-4" />,
    Search: <Search className="h-4 w-4" />,
    FolderSearch: <FolderSearch className="h-4 w-4" />,
    Globe: <Globe className="h-4 w-4" />,
    Globe2: <Globe2 className="h-4 w-4" />,
    Terminal: <Terminal className="h-4 w-4" />,
    Monitor: <Monitor className="h-4 w-4" />,
    XCircle: <XCircle className="h-4 w-4" />,
    ListTodo: <ListTodo className="h-4 w-4" />,
    CheckSquare: <CheckSquare className="h-4 w-4" />,
    Flag: <Flag className="h-4 w-4" />,
    Tool: <Wrench className="h-4 w-4" />,
  };

  return iconMap[iconName] || <Wrench className="h-4 w-4" />;
};

export const TaskChat: React.FC<TaskChatProps> = ({ task: propTask }) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<Map<string, StreamingMessage>>(new Map());
  const [_expandedEvents, _setExpandedEvents] = useState<Set<string>>(new Set());
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Subscribe to activeTask from store for real-time updates
  const { activeTask } = useTaskStore();

  // Use activeTask from store if available, otherwise fall back to prop
  const task = activeTask || propTask;

  // Auto-scroll to bottom when new messages arrive or streaming content updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [task.messages, streamingMessages]);

  // Listen for Claude streaming events
  useEffect(() => {
    const handleStreamEvent = (taskId: string, messageId: string, event: ClaudeStreamEvent) => {
      if (taskId !== task.id) return;

      setStreamingMessages((prev) => {
        const newMap = new Map(prev);
        const currentMessage = newMap.get(messageId) || {
          id: messageId,
          content: '',
          isStreaming: true,
          events: [],
        };

        switch (event.type) {
          case 'partial':
            currentMessage.content = event.content || '';
            currentMessage.isStreaming = true;
            break;

          case 'complete':
            currentMessage.content = event.content || '';
            currentMessage.isStreaming = false;
            setIsLoading(false);
            setActiveMessageId(null);
            // Remove from streaming messages after completion
            setTimeout(() => {
              setStreamingMessages((prev) => {
                const newMap = new Map(prev);
                newMap.delete(messageId);
                return newMap;
              });
            }, 100);
            break;

          case 'tool_start':
            currentMessage.events.push({
              id: `${messageId}-${Date.now()}`,
              type: 'tool_use',
              toolName: event.toolName,
              description: `Using ${event.toolName}`,
              status: 'started',
              timestamp: new Date(),
            });
            break;

          case 'tool_end': {
            // Update the last tool event to completed
            const lastEvent = currentMessage.events[currentMessage.events.length - 1];
            if (lastEvent && lastEvent.toolName === event.toolName) {
              lastEvent.status = 'completed';
            }
            break;
          }

          case 'error':
            currentMessage.events.push({
              id: `${messageId}-error-${Date.now()}`,
              type: 'error',
              description: event.error || 'An error occurred',
              status: 'failed',
              timestamp: new Date(),
            });
            currentMessage.isStreaming = false;
            setIsLoading(false);
            setActiveMessageId(null);
            break;
        }

        newMap.set(messageId, currentMessage);
        return newMap;
      });
    };

    window.electronAPI.claude.onStreamEvent(handleStreamEvent);

    return () => {
      window.electronAPI.claude.removeClaudeListeners();
    };
  }, [task.id]);

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const messageText = message.trim();
    setMessage('');
    setIsLoading(true);

    try {
      // Send message to Claude instead of the old echo handler
      const response = await window.electronAPI.claude.sendMessage(task.id, messageText);

      if (response.success && response.data) {
        setActiveMessageId(response.data.messageId);
        // The streaming events will handle the rest
      } else {
        throw new Error(response.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
    }
  };

  const handleCancelQuery = async () => {
    if (activeMessageId) {
      try {
        await window.electronAPI.claude.cancelQuery(activeMessageId);
        setActiveMessageId(null);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to cancel query:', error);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const _toggleEventExpansion = (eventId: string) => {
    _setExpandedEvents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const formatMessageContent = (content: string) => {
    // Basic markdown-like formatting
    return content.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  const formatTimestamp = (timestamp: Date | string | number) => {
    // Safely convert timestamp to Date and format it
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      return date.toLocaleTimeString();
    } catch {
      return 'Unknown time';
    }
  };

  const renderEvents = (events: EventInfo[]) => {
    if (events.length === 0) return null;

    return (
      <div className="mt-2 space-y-1">
        {events.map((event) => (
          <div
            key={event.id}
            className={cn(
              'flex items-center gap-2 rounded px-2 py-1 text-xs',
              event.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
            )}
          >
            {event.toolName && getIconForTool(event.toolName)}
            <span className="flex-1">{event.description || event.toolName}</span>
            {event.status === 'started' && <Loader2 className="h-3 w-3 animate-spin" />}
            {event.status === 'completed' && <CheckCircle className="h-3 w-3 text-green-600" />}
            {event.status === 'failed' && <AlertCircle className="h-3 w-3 text-red-600" />}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6">
        {task.messages.length === 0 && streamingMessages.size === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Bot className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-medium">Start a conversation</h3>
            <p className="text-muted-foreground max-w-md text-sm">
              Describe what you want to build or ask questions about your code. Claude will help you with your task.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {task.messages.map((msg) => {
              // Check if this message is being streamed
              const streamingMsg = streamingMessages.get(msg.id);
              const displayContent = streamingMsg ? streamingMsg.content : msg.content;
              const displayEvents = streamingMsg ? streamingMsg.events : [];
              const isStreaming = streamingMsg?.isStreaming || false;

              return (
                <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
                  <div
                    className={cn(
                      'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                      msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}
                  >
                    {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  <div className={cn('flex-1 space-y-1', msg.role === 'user' && 'text-right')}>
                    <div className="text-muted-foreground text-xs">
                      {msg.role === 'user' ? 'You' : 'Claude'}
                      {' • '}
                      {formatTimestamp(msg.timestamp)}
                      {isStreaming && (
                        <span className="ml-2 text-blue-600">
                          <Loader2 className="inline h-3 w-3 animate-spin" /> Thinking...
                        </span>
                      )}
                    </div>
                    <div
                      className={cn(
                        'inline-block rounded-lg px-4 py-2 text-sm',
                        msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}
                    >
                      {formatMessageContent(displayContent || '...')}
                      {msg.role === 'assistant' && renderEvents(displayEvents)}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Show streaming messages that don't have a corresponding message in task.messages yet */}
            {Array.from(streamingMessages.entries()).map(([msgId, streamingMsg]) => {
              // Skip if this message already exists in task.messages
              if (task.messages.some((m) => m.id === msgId)) return null;

              return (
                <div key={msgId} className="flex gap-3">
                  <div className="bg-muted flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-muted-foreground text-xs">
                      Claude
                      {streamingMsg.isStreaming && (
                        <span className="ml-2 text-blue-600">
                          <Loader2 className="inline h-3 w-3 animate-spin" /> Working...
                        </span>
                      )}
                    </div>
                    <div className="bg-muted inline-block rounded-lg px-4 py-2 text-sm">
                      {streamingMsg.content ? (
                        formatMessageContent(streamingMsg.content)
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {renderEvents(streamingMsg.events)}
                    </div>
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="bg-background border-t p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Shift+Enter for new line)"
              className="bg-background focus:ring-primary flex-1 resize-none rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
              rows={3}
              disabled={isLoading}
            />
            <div className="flex flex-col gap-2">
              <Button onClick={handleSend} disabled={!message.trim() || isLoading} size="sm" className="self-end">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
              {isLoading && activeMessageId && (
                <Button onClick={handleCancelQuery} size="sm" variant="outline" className="self-end">
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="text-muted-foreground mt-2 text-xs">
            Press Enter to send, Shift+Enter for new line
            {isLoading && ' • Claude is working on your request...'}
          </div>
        </div>
      </div>
    </div>
  );
};
