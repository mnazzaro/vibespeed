import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Task, ChatMessage } from '@/shared/types/tasks';
import { useTaskStore } from '@/renderer/store/tasks';

interface TaskChatProps {
  task: Task;
}

export const TaskChat: React.FC<TaskChatProps> = ({ task: propTask }) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Subscribe to activeTask from store for real-time updates
  const { activeTask, sendMessage } = useTaskStore();
  
  // Use activeTask from store if available, otherwise fall back to prop
  const task = activeTask || propTask;
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [task.messages]);
  
  // Listen for message responses
  useEffect(() => {
    const handleMessageReceived = (taskId: string, message: ChatMessage) => {
      if (taskId === task.id) {
        setIsLoading(false);
      }
    };
    
    window.electronAPI.tasks.onMessageReceived(handleMessageReceived);
    
    return () => {
      window.electronAPI.tasks.removeTaskListeners();
    };
  }, [task.id]);
  
  const handleSend = async () => {
    if (!message.trim() || isLoading) return;
    
    const messageText = message.trim();
    setMessage('');
    setIsLoading(true);
    
    try {
      await sendMessage(task.id, messageText);
      // Response will come via the event listener
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const formatMessageContent = (content: string) => {
    // Basic markdown-like formatting
    // This is a placeholder - you might want to use a proper markdown renderer
    return content.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </span>
    ));
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6">
        {task.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Describe what you want to build or ask questions about your code.
              Messages will be processed when Claude integration is complete.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {task.messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3",
                  msg.role === 'user' && "flex-row-reverse"
                )}
              >
                <div className={cn(
                  "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center",
                  msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {msg.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                
                <div className={cn(
                  "flex-1 space-y-1",
                  msg.role === 'user' && "text-right"
                )}>
                  <div className="text-xs text-muted-foreground">
                    {msg.role === 'user' ? 'You' : 'Assistant'}
                    {' • '}
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                  <div className={cn(
                    "inline-block px-4 py-2 rounded-lg text-sm",
                    msg.role === 'user' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted"
                  )}>
                    {formatMessageContent(msg.content)}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="inline-block px-4 py-2 rounded-lg bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Input area */}
      <div className="border-t bg-background p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Shift+Enter for new line)"
              className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!message.trim() || isLoading}
              size="sm"
              className="self-end"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <div className="mt-2 text-xs text-muted-foreground">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
};