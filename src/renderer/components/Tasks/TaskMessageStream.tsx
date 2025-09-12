import { SDKAssistantMessage, SDKMessage, SDKSystemMessage } from '@anthropic-ai/claude-code';
import { Bot } from 'lucide-react';
import React, { useRef, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { ToolUsageProvider } from '@/renderer/components/Tasks/TaskChat';
import {
  ReadTool,
  WriteTool,
  EditTool,
  MultiEditTool,
  BashTool,
  BashOutputTool,
  KillBashTool,
  WebSearchTool,
  WebFetchTool,
  TaskTool,
  TodoWriteTool,
  NotebookEditTool,
  ExitPlanModeTool,
} from '@/renderer/components/Tasks/Tools';

interface TaskMessageStreamProps {
  messages: (SDKMessage | string)[];
}

// Component for rendering markdown content
const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="prose dark:prose-invert max-w-none my-2">
      <ReactMarkdown
        components={{
          // Enhanced header components with proper sizing
          h1: ({ children, ...props }) => (
            <h1 className="text-3xl font-semibold mb-4 first:mt-0 mt-6 text-foreground" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-2xl font-semibold mb-3 first:mt-0 mt-5 text-foreground" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-xl font-semibold mb-2 first:mt-0 mt-4 text-foreground" {...props}>
              {children}
            </h3>
          ),
          h4: ({ children, ...props }) => (
            <h4 className="text-lg font-semibold mb-2 first:mt-0 mt-3 text-foreground" {...props}>
              {children}
            </h4>
          ),
          h5: ({ children, ...props }) => (
            <h5 className="text-base font-semibold mb-1 first:mt-0 mt-3 text-foreground" {...props}>
              {children}
            </h5>
          ),
          h6: ({ children, ...props }) => (
            <h6 className="text-sm font-semibold mb-1 first:mt-0 mt-2 text-foreground" {...props}>
              {children}
            </h6>
          ),
          // Enhanced paragraph spacing
          p: ({ children, ...props }) => (
            <p className="mb-3 first:mt-0 last:mb-0 text-foreground leading-relaxed" {...props}>
              {children}
            </p>
          ),
          // Enhanced list styling
          ul: ({ children, ...props }) => (
            <ul className="mb-3 last:mb-0 ml-4 list-disc space-y-1" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="mb-3 last:mb-0 ml-4 list-decimal space-y-1" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="text-foreground" {...props}>
              {children}
            </li>
          ),
          // Enhanced blockquote styling
          blockquote: ({ children, ...props }) => (
            <blockquote className="border-l-4 border-muted-foreground pl-4 my-4 first:mt-0 last:mb-0 italic text-muted-foreground bg-muted/20 py-2 rounded-r" {...props}>
              {children}
            </blockquote>
          ),
          // Code blocks and inline code
          code({ className, children, ...props }: any) {
            const inline = !className;
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <div className="my-4 rounded-lg overflow-hidden bg-card border border-border">
                <SyntaxHighlighter 
                  style={oneDark as any} 
                  language={match[1]} 
                  PreTag="div" 
                  customStyle={{
                    margin: 0,
                    background: 'hsl(var(--card))',
                    fontSize: '0.875rem',
                  }}
                  {...(props as any)}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code className="rounded bg-card px-2 py-1 text-sm font-mono border border-border text-foreground" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

const ToolUseComponent: React.FC<{ toolId: string }> = ({ toolId }) => {
  const { toolStates } = useContext(ToolUsageProvider);
  const toolState = toolStates.get(toolId);
  if (!toolState) return null;
  const input = toolState.input;
  switch (toolState.name) {
    case 'Read':
      return <ReadTool input={input} />;
    case 'Write':
      return <WriteTool input={input} />;
    case 'Edit':
      return <EditTool input={input} />;
    case 'MultiEdit':
      return <MultiEditTool input={input} />;
    case 'Bash':
      return <BashTool input={input} />;
    case 'BashOutput':
      return <BashOutputTool input={input} />;
    case 'KillBash':
      return <KillBashTool input={input} />;
    case 'Grep':
      return null;
    // return <GrepTool input={input} />;
    case 'Glob':
      return null;
    // return <GlobTool input={input} />;
    case 'WebSearch':
      return <WebSearchTool input={input} />;
    case 'WebFetch':
      return <WebFetchTool input={input} />;
    case 'Task':
      return <TaskTool input={input} />;
    case 'TodoWrite':
      return <TodoWriteTool input={input} />;
    case 'NotebookEdit':
      return <NotebookEditTool input={input} />;
    case 'ExitPlanMode':
      return <ExitPlanModeTool input={input} />;
    default:
      return null;
  }
};

const SystemMessageComponent: React.FC<{ message: SDKSystemMessage }> = ({ message }) => {
  if (message.subtype === 'init') return null;
};

const AssistantMessageComponent: React.FC<{
  message: SDKAssistantMessage;
}> = ({ message }) => {
  for (const content of message.message.content) {
    if (content.type === 'text') {
      return <MarkdownContent content={content.text} />;
    } else if (content.type === 'tool_use') {
      return <ToolUseComponent toolId={content.id} />;
    } else {
      return null;
    }
  }
};

// Main TaskMessageStream Component
export const TaskMessageStream: React.FC<TaskMessageStreamProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const renderMessage = (message: SDKMessage | string) => {
    // Route to the appropriate component based on message type

    if (typeof message === 'string') {
      return (
        <div className="relative my-6">
          {/* Horizontal line above */}
          <div className="absolute -top-3 left-0 h-px w-6 bg-gray-400 dark:bg-gray-600"></div>

          {/* Main content */}
          <div className="pl-4">
            <MarkdownContent content={'# User Message:\n' + message} />
          </div>

          {/* L-shaped border below */}
          <div className="absolute -bottom-3 left-0">
            <div className="h-3 w-px bg-gray-400 dark:bg-gray-600"></div>
            <div className="h-px w-6 bg-gray-400 dark:bg-gray-600"></div>
          </div>
        </div>
      );
    }

    switch (message.type) {
      case 'assistant':
        return <AssistantMessageComponent message={message as SDKAssistantMessage} />;

      case 'system':
        return <SystemMessageComponent message={message as SDKSystemMessage} />;

      case 'result':
        // We get the message as an assistant message first, so this causes a duplicate if we render it
        return null;

      // Skip certain message types
      case 'user':
      case 'stream_event':
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col space-y-2 px-4 py-2">
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-12 text-center">
          <Bot className="mb-4 h-12 w-12 text-gray-400" />
          <h3 className="mb-2 text-lg font-medium text-gray-700">No messages yet</h3>
          <p className="max-w-md text-sm text-gray-500">Start a conversation to see messages appear here.</p>
        </div>
      ) : (
        <>
          {messages.map((message) => renderMessage(message))}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
};
