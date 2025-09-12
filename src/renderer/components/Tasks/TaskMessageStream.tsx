import { SDKAssistantMessage, SDKMessage, SDKSystemMessage } from '@anthropic-ai/claude-code';
import {
  Bot,
  FileEdit,
  Notebook,
  Search,
  FolderSearch,
  Globe,
  Globe2,
  Terminal,
  Monitor,
  XCircle,
  ListTodo,
  CheckSquare,
  Flag,
  BookOpen,
} from 'lucide-react';
import React, { useRef, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { ToolUsageProvider } from '@/renderer/components/Tasks/TaskChat';

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
  if (toolState.name === 'Read') {
    return (
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4" />
        <span>Reading {toolState.input}</span>
      </div>
    );
  } else if (toolState.name === 'Write') {
    return (
      <div className="flex items-center gap-2">
        <FileEdit className="h-4 w-4" />
        <span>Writing {toolState.input}</span>
      </div>
    );
  } else if (toolState.name === 'Edit') {
    return (
      <div className="flex items-center gap-2">
        <FileEdit className="h-4 w-4" />
        <span>Editing {toolState.input}</span>
      </div>
    );
  } else if (toolState.name === 'MultiEdit') {
    return (
      <div className="flex items-center gap-2">
        <FileEdit className="h-4 w-4" />
        <span>Multi-editing {toolState.input.toString()}</span>
      </div>
    );
  } else if (toolState.name === 'Bash') {
    return (
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4" />
        <span>Bashing {toolState.input.toString()}</span>
      </div>
    );
  } else if (toolState.name === 'BashOutput') {
    return (
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4" />
        <span>Bash output {toolState.input.toString()}</span>
      </div>
    );
  } else if (toolState.name === 'KillBash') {
    return (
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4" />
        <span>Killing bash {toolState.input.toString()}</span>
      </div>
    );
  } else if (toolState.name === 'Grep') {
    return (
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4" />
        <span>Grepping {toolState.input.toString()}</span>
      </div>
    );
  } else if (toolState.name === 'Glob') {
    return (
      <div className="flex items-center gap-2">
        <FolderSearch className="h-4 w-4" />
        <span>Globbing {toolState.input.toString()}</span>
      </div>
    );
  } else if (toolState.name === 'WebSearch') {
    return (
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4" />
        <span>Web searching {toolState.input.toString()}</span>
      </div>
    );
  } else if (toolState.name === 'WebFetch') {
    return (
      <div className="flex items-center gap-2">
        <Globe2 className="h-4 w-4" />
        <span>Web fetching {toolState.input.toString()}</span>
      </div>
    );
  } else if (toolState.name === 'Task') {
    return (
      <div className="flex items-center gap-2">
        <ListTodo className="h-4 w-4" />
        <span>Tasking {toolState.input.toString()}</span>
      </div>
    );
  } else if (toolState.name === 'TodoWrite') {
    return (
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4" />
        <span>Todo writing {toolState.input.toString()}</span>
      </div>
    );
  } else if (toolState.name === 'NotebookEdit') {
    return (
      <div className="flex items-center gap-2">
        <Notebook className="h-4 w-4" />
        <span>Notebook editing {toolState.input.toString()}</span>
      </div>
    );
  } else if (toolState.name === 'ExitPlanMode') {
    return (
      <div className="flex items-center gap-2">
        <Flag className="h-4 w-4" />
        <span>Exit plan mode {toolState.input.toString()}</span>
      </div>
    );
  } else {
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
    console.log(content);
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
