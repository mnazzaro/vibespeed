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
  GrepTool,
  GlobTool,
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
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        components={{
          code({ className, children, ...props }: any) {
            const inline = !className;
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter style={oneDark as any} language={match[1]} PreTag="div" {...(props as any)}>
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className="rounded bg-gray-100 px-1 py-0.5 text-sm" {...props}>
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
      return <GrepTool input={input} />;
    case 'Glob':
      return <GlobTool input={input} />;
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
      return <MarkdownContent content={'# USER MESSAGE:\n' + message} />;
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
