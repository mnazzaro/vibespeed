import { Send, Loader2, XCircle, ClipboardCheck, Brain, Sparkles, Zap, ChevronDown } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ThinkingLevel = 'default' | 'superthink' | 'gigathink';
export type Model = 'opus' | 'sonnet';

interface TaskInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (options: { message: string; thinkingLevel: ThinkingLevel; planMode: boolean; model: Model }) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  canCancel?: boolean;
  disabled?: boolean;
}

const thinkingIcons = {
  default: <Brain className="h-3.5 w-3.5" />,
  superthink: <Sparkles className="h-3.5 w-3.5" />,
  gigathink: <Zap className="h-3.5 w-3.5" />,
};

// Simple dropdown component
interface DropdownProps {
  value: string;
  options: { value: string; label: React.ReactNode }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const Dropdown: React.FC<DropdownProps> = ({ value, options, onChange, disabled, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center justify-between gap-1 rounded-md border px-2 py-1 text-xs',
          'bg-background hover:bg-accent hover:text-accent-foreground',
          'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        <span className="flex items-center gap-1">{selectedOption?.label}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {isOpen && (
        <div className="bg-popover absolute bottom-full left-0 z-50 mb-1 min-w-[100px] rounded-md border p-1 shadow-md">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded px-2 py-1 text-xs',
                'hover:bg-accent hover:text-accent-foreground',
                value === option.value && 'bg-accent'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const TaskInput: React.FC<TaskInputProps> = ({
  value,
  onChange,
  onSend,
  onCancel,
  isLoading = false,
  canCancel = false,
  disabled = false,
}) => {
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('default');
  const [planMode, setPlanMode] = useState(false);
  const [model, setModel] = useState<Model>('sonnet');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const placeholder = planMode ? 'Ask Claude anything...' : 'Ask Claude to make a plan...';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!value.trim() || isLoading) return;

    onSend({
      message: value.trim(),
      thinkingLevel,
      planMode,
      model,
    });
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  // Reset height when value changes externally (e.g., after sending)
  useEffect(() => {
    if (textareaRef.current && value === '') {
      textareaRef.current.style.height = '44px';
    }
  }, [value]);

  return (
    <div className="relative">
      {/* Plan mode indicator in the border */}
      {planMode && (
        <div className="bg-background absolute -top-2 right-4 z-10 px-1">
          <div className="flex items-center gap-1">
            <ClipboardCheck className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-medium text-blue-600">Plan Mode</span>
          </div>
        </div>
      )}

      <div
        className={cn(
          'bg-background rounded-xl border transition-colors duration-150',
          planMode && 'border-blue-500 shadow-sm shadow-blue-100'
        )}
      >
        {/* Textarea at the top */}
        <div className="p-3 pb-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              'w-full resize-none bg-transparent text-sm',
              'placeholder:text-muted-foreground focus:outline-none',
              'min-h-[44px]'
            )}
            rows={1}
            disabled={disabled || isLoading}
          />
        </div>

        {/* Controls at the bottom */}
        <div className="flex items-center justify-between border-t px-3 py-2">
          <div className="flex items-center gap-2">
            {/* Thinking Level Selector */}
            <Dropdown
              value={thinkingLevel}
              onChange={(value) => setThinkingLevel(value as ThinkingLevel)}
              disabled={isLoading}
              options={[
                {
                  value: 'default',
                  label: (
                    <>
                      {thinkingIcons.default}
                      <span>Default</span>
                    </>
                  ),
                },
                {
                  value: 'superthink',
                  label: (
                    <>
                      {thinkingIcons.superthink}
                      <span>Superthink</span>
                    </>
                  ),
                },
                {
                  value: 'gigathink',
                  label: (
                    <>
                      {thinkingIcons.gigathink}
                      <span>Gigathink</span>
                    </>
                  ),
                },
              ]}
              className="h-7 w-[110px]"
            />

            {/* Model Selector */}
            <Dropdown
              value={model}
              onChange={(value) => setModel(value as Model)}
              disabled={isLoading}
              options={[
                { value: 'sonnet', label: 'Sonnet' },
                { value: 'opus', label: 'Opus' },
              ]}
              className="h-7 w-[90px]"
            />

            {/* Plan Mode Toggle */}
            <Button
              variant={planMode ? 'secondary' : 'ghost'}
              size="sm"
              className={cn('h-7 px-2 text-xs', planMode && 'bg-blue-50 text-blue-700 hover:bg-blue-100')}
              onClick={() => setPlanMode(!planMode)}
              disabled={isLoading}
            >
              <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
              Plan
            </Button>
          </div>

          {/* Send/Cancel buttons */}
          <div className="flex items-center gap-1">
            {isLoading && canCancel && onCancel && (
              <Button onClick={onCancel} size="icon" variant="ghost" className="h-7 w-7">
                <XCircle className="h-4 w-4" />
              </Button>
            )}
            <Button
              onClick={handleSend}
              disabled={!value.trim() || isLoading}
              size="icon"
              variant="default"
              className="h-7 w-7"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
