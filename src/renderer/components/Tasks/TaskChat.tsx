import {
  Send,
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
  AlertCircle,
  Brain,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  thinkingBlocks: string[];
}

interface EventInfo {
  id: string;
  type: 'tool_use' | 'status' | 'error' | 'text' | 'stream_event' | 'thinking';
  toolName?: string;
  description?: string;
  status?: 'started' | 'completed' | 'failed';
  timestamp: Date;
  params?: any;
  result?: any;
  tool?: {
    id?: string;
    name: string;
    parameters?: Record<string, any>;
    status: 'started' | 'completed' | 'failed';
    result?: string;
  };
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
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Subscribe to activeTask from store for real-time updates
  const { activeTask, sendMessage, updateTask } = useTaskStore();

  // Use activeTask from store if available, otherwise fall back to prop
  const task = activeTask || propTask;

  // Auto-scroll to bottom when new messages arrive or streaming content updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [task.messages, streamingMessages]);

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
    const handleStreamEvent = (taskId: string, messageId: string, event: ClaudeStreamEvent) => {
      if (taskId !== task.id) return;

      // Debug logging
      console.log('[TaskChat] Stream event received:', event.type, event);

      setStreamingMessages((prev) => {
        const newMap = new Map(prev);
        const currentMessage = newMap.get(messageId) || {
          id: messageId,
          content: '',
          isStreaming: true,
          events: [],
          thinkingBlocks: [],
        };

        switch (event.type) {
          case 'partial':
            currentMessage.content = event.content || '';
            currentMessage.isStreaming = true;
            break;

          case 'complete':
            currentMessage.content = event.content || '';
            currentMessage.isStreaming = false;
            // Preserve all events and thinking blocks from the complete event
            if (event.events) {
              currentMessage.events = event.events;
            }
            if (event.thinkingBlocks) {
              currentMessage.thinkingBlocks = event.thinkingBlocks;
            }
            setIsLoading(false);
            setActiveMessageId(null);
            // Keep the streaming message with all its data
            // The task update from backend will eventually sync it
            break;

          case 'tool_start': {
            // Check if we already have this tool event (deduplication during streaming)
            const existingToolEvent = event.toolUseId
              ? currentMessage.events.find((e) => e.id === event.toolUseId || e.tool?.id === event.toolUseId)
              : null;

            // Only add if we don't already have this tool
            if (!existingToolEvent) {
              currentMessage.events.push({
                id: event.toolUseId || `${messageId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'tool_use',
                toolName: event.toolName,
                description: `Using ${event.toolName}`,
                status: 'started',
                timestamp: new Date(),
                params: event.toolParams,
                tool: {
                  id: event.toolUseId,
                  name: event.toolName,
                  parameters: event.toolParams,
                  status: 'started',
                },
              });
            } else {
              // Update existing tool event if parameters changed
              if (event.toolParams && existingToolEvent.tool) {
                existingToolEvent.tool.parameters = event.toolParams;
                existingToolEvent.params = event.toolParams;
              }
            }
            break;
          }

          case 'tool_end': {
            // Find the tool event by ID and update to completed
            const toolEvent = event.toolUseId
              ? currentMessage.events.find((e) => e.id === event.toolUseId || e.tool?.id === event.toolUseId)
              : currentMessage.events.filter((e) => e.toolName === event.toolName).pop();

            if (toolEvent) {
              toolEvent.status = 'completed';
              if (toolEvent.tool) {
                toolEvent.tool.status = 'completed';
              }
            }
            break;
          }

          case 'tool_result': {
            // Find the tool event by ID and update its result
            const toolEvent = event.toolUseId
              ? currentMessage.events.find((e) => e.id === event.toolUseId || e.tool?.id === event.toolUseId)
              : currentMessage.events.filter((e) => e.toolName === event.toolName).pop();

            if (toolEvent) {
              if (toolEvent.tool) {
                toolEvent.tool.result = event.toolResult;
              } else {
                toolEvent.result = event.toolResult;
              }
            }
            break;
          }

          case 'thinking': {
            // Add thinking as a special type of event that appears in the flow
            if (event.thinkingContent) {
              currentMessage.events.push({
                id: `${messageId}-thinking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'thinking',
                description: event.thinkingContent,
                timestamp: new Date(),
                status: 'completed',
              });
            }
            break;
          }

          case 'error':
            currentMessage.events.push({
              id: `${messageId}-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = '44px';
    }
    setIsLoading(true);

    try {
      // First, add the user message to the store (this will update the UI immediately)
      await sendMessage(task.id, messageText);

      // Then send to Claude for processing
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

  const toggleEventExpansion = (eventId: string) => {
    setExpandedEvents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const toggleThinkingExpansion = (messageId: string) => {
    setExpandedThinking((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
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

  const renderThinkingBlocks = (messageId: string, thinkingBlocks: string[] | undefined) => {
    if (!thinkingBlocks || thinkingBlocks.length === 0) return null;

    const isExpanded = expandedThinking.has(messageId);
    const thinkingContent = thinkingBlocks.join('\n');

    return (
      <div className="mx-auto mb-2">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <Brain className="h-4 w-4 text-gray-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="cursor-pointer text-xs text-gray-600 hover:text-gray-800"
              onClick={() => toggleThinkingExpansion(messageId)}
            >
              <span className="font-medium">Claude's Thinking</span>
              <span className="ml-2 text-gray-400">
                {isExpanded ? <ChevronDown className="inline h-3 w-3" /> : <ChevronRight className="inline h-3 w-3" />}
                {isExpanded ? ' Hide' : ' Show'} thinking process
              </span>
            </div>
            {isExpanded && (
              <div className="mt-2 rounded bg-blue-50 p-3 text-xs">
                <pre className="overflow-x-auto whitespace-pre-wrap text-gray-700">{thinkingContent}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderThinkingEvent = (event: EventInfo) => {
    const isExpanded = expandedEvents.has(event.id);

    return (
      <div className="mx-auto mb-2">
        <div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Brain className="h-4 w-4 text-blue-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="flex cursor-pointer items-center text-xs text-gray-600 hover:text-gray-800"
                onClick={() => toggleEventExpansion(event.id)}
              >
                <span className="font-medium">Thinking</span>
                <span className="ml-2 text-gray-400">{isExpanded ? '▼' : '▶'}</span>
              </div>
            </div>
          </div>
          {isExpanded && (
            <div className="mt-2 rounded bg-blue-50 p-3 text-xs">
              <pre className="overflow-x-auto whitespace-pre-wrap text-gray-700">{event.description}</pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderToolCall = (event: any) => {
    // Handle both EventInfo (from streaming) and ClaudeEvent (from metadata) structures
    const toolName = event.toolName || event.tool?.name;
    const toolParams = event.params || event.tool?.parameters;
    const toolStatus = event.status || event.tool?.status;
    const toolResult = event.result || event.tool?.result;

    const isExpanded = expandedEvents.has(event.id);
    const hasExpandableData = (toolParams && Object.keys(toolParams).length > 0) || toolResult;

    // Only render if there's expandable data (per requirement)
    if (!hasExpandableData) {
      return null;
    }

    return (
      <div className="mx-auto mb-2">
        <div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">{toolName && getIconForTool(toolName)}</div>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  'flex items-center text-xs text-gray-600',
                  hasExpandableData && 'cursor-pointer hover:text-gray-800'
                )}
                onClick={() => hasExpandableData && toggleEventExpansion(event.id)}
              >
                <span className="font-medium">{toolName || 'Tool'}</span>
                {hasExpandableData && <span className="ml-2 text-gray-400">{isExpanded ? '▼' : '▶'}</span>}
                {toolStatus === 'failed' && <AlertCircle className="ml-2 inline h-3 w-3 text-red-600" />}
              </div>
            </div>
          </div>
          {isExpanded && hasExpandableData && (
            <div className="mt-2 rounded bg-gray-50 p-3 text-xs">
              {toolParams && Object.keys(toolParams).length > 0 && (
                <div>
                  <div className="mb-1 font-medium text-gray-600">Parameters:</div>
                  <pre className="overflow-x-auto whitespace-pre-wrap text-gray-700">
                    {JSON.stringify(toolParams, null, 2)}
                  </pre>
                </div>
              )}
              {toolResult && (
                <div className={toolParams ? 'mt-3 border-t border-gray-200 pt-3' : ''}>
                  <div className="mb-1 font-medium text-gray-600">Result:</div>
                  <pre className="overflow-x-auto whitespace-pre-wrap text-gray-700">
                    {typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
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
              // Use events from message metadata when complete, otherwise from streaming
              const messageEvents = msg.metadata?.events || [];
              const displayEvents = streamingMsg ? streamingMsg.events : messageEvents;
              const _isStreaming = streamingMsg?.isStreaming || false;

              return (
                <React.Fragment key={msg.id}>
                  {/* Render events (tools and thinking) in sequence for assistant messages */}
                  {msg.role === 'assistant' &&
                    displayEvents.length > 0 &&
                    displayEvents.map((event: any, index: number) => {
                      if (event.type === 'thinking') {
                        return (
                          <React.Fragment key={`${msg.id}-thinking-${event.id || index}`}>
                            {renderThinkingEvent(event)}
                          </React.Fragment>
                        );
                      } else if (event.type === 'tool_use' || event.toolName || event.tool?.name) {
                        // Use tool ID if available for stable keys during streaming
                        const toolId = event.tool?.id || event.id || `${index}`;
                        return (
                          <React.Fragment key={`${msg.id}-tool-${toolId}`}>{renderToolCall(event)}</React.Fragment>
                        );
                      }
                      return null;
                    })}

                  {/* Render the actual message if there's content */}
                  {displayContent && (
                    <div className="mx-auto mb-4">
                      <div className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
                        <div className={cn('flex-1 space-y-1', msg.role === 'user' && 'text-right')}>
                          <div className="text-muted-foreground text-xs">{formatTimestamp(msg.timestamp)}</div>
                          <div
                            className={cn(
                              'inline-block rounded-lg px-4 py-2 text-sm',
                              msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            )}
                          >
                            {formatMessageContent(displayContent)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Show streaming messages that don't have a corresponding message in task.messages yet */}
            {Array.from(streamingMessages.entries()).map(([msgId, streamingMsg]) => {
              // Skip if this message already exists in task.messages
              if (task.messages.some((m) => m.id === msgId)) return null;

              return (
                <React.Fragment key={msgId}>
                  {/* Render thinking blocks for streaming messages */}
                  {streamingMsg.thinkingBlocks &&
                    streamingMsg.thinkingBlocks.length > 0 &&
                    renderThinkingBlocks(msgId, streamingMsg.thinkingBlocks)}

                  {/* Render streaming tool calls */}
                  {streamingMsg.events.length > 0 &&
                    streamingMsg.events.map((event: any, index: number) =>
                      event.type === 'tool_use' || event.toolName ? (
                        <React.Fragment key={`${msgId}-stream-event-${event.id || index}`}>
                          {renderToolCall(event)}
                        </React.Fragment>
                      ) : null
                    )}

                  {/* Show loading if still streaming with no content */}
                  {streamingMsg.isStreaming && !streamingMsg.content && (
                    <div className="mx-auto mb-2">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                    </div>
                  )}

                  {/* Render the streaming message content if available */}
                  {streamingMsg.content && (
                    <div className="mx-auto mb-4">
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <div className="text-muted-foreground text-xs">{formatTimestamp(new Date())}</div>
                          <div className="bg-muted inline-block rounded-lg px-4 py-2 text-sm">
                            {formatMessageContent(streamingMsg.content)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-4">
        <div className="mx-auto">
          <div className="relative flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                // Auto-resize textarea
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask Claude anything..."
              className="min-h-[44px] resize-none pr-2"
              rows={1}
              disabled={isLoading}
            />
            <div className="flex flex-col gap-1 pb-2">
              {isLoading && activeMessageId && (
                <Button onClick={handleCancelQuery} size="icon" variant="ghost" className="h-8 w-8">
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
              <Button
                onClick={handleSend}
                disabled={!message.trim() || isLoading}
                size="icon"
                variant="secondary"
                className="h-8 w-8"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
