import { Options } from '@anthropic-ai/claude-code';
import React, { useState, useRef, useEffect } from 'react';

import { cn } from '@/lib/utils';

export type ThinkingLevel = 'default' | 'superthink' | 'gigathink';
export type Model = 'opus' | 'sonnet';

interface TaskInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (options: Partial<Options>) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  canCancel?: boolean;
  disabled?: boolean;
}

// Simple dropdown component
interface DropdownProps {
  value: string;
  options: { value: string; label: React.ReactNode }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const buildClaudeOptions = (planMode: boolean, thinkingLevel: ThinkingLevel, model: Model): Partial<Options> => {
  return {
    permissionMode: planMode ? 'plan' : 'bypassPermissions',
    ...(thinkingLevel === 'default'
      ? { maxTurns: 20, maxThinkingTokens: 25000 }
      : thinkingLevel === 'superthink'
        ? { maxTurns: 80, maxThinkingTokens: 50000 }
        : { maxTurns: 100, maxThinkingTokens: 100000 }),
    model: model === 'sonnet' ? 'claude-sonnet-4-20250514' : 'claude-opus-4-1-20250805',
  };
};

const Dropdown: React.FC<DropdownProps> = React.memo(({ value, options, onChange, disabled, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return; // Only add listener when dropdown is open

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]); // Only re-register when isOpen changes

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center justify-between gap-1 border-b px-2 py-1 font-mono text-xs',
          'hover:bg-accent/20 bg-transparent transition-colors',
          'focus:outline-none',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        <span className="flex items-center gap-1">{selectedOption?.label}</span>
        <span className="text-muted-foreground">▾</span>
      </button>
      {isOpen && (
        <div className="bg-popover shadow-paper absolute bottom-full left-0 z-50 mb-1 min-w-[100px] border p-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 px-2 py-1 font-mono text-xs',
                'hover:bg-accent/30 transition-colors',
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
});

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
  const placeholder = planMode ? 'Ask Claude to make a plan...' : 'Ask Claude anything...';

  const handleSend = React.useCallback(() => {
    if (!value.trim() || isLoading) return;

    onSend({
      ...buildClaudeOptions(planMode, thinkingLevel, model),
    });
  }, [value, isLoading, onSend, planMode, thinkingLevel, model]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleTextareaChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      // Auto-resize textarea - use RAF to avoid blocking the main thread
      requestAnimationFrame(() => {
        if (e.target) {
          e.target.style.height = 'auto';
          e.target.style.height = e.target.scrollHeight + 'px';
        }
      });
    },
    [onChange]
  );

  // Reset height when value changes externally (e.g., after sending)
  useEffect(() => {
    if (textareaRef.current && value === '') {
      textareaRef.current.style.height = '44px';
    }
  }, [value]);

  return (
    <div className="relative flex min-h-30 flex-col border-t">
      {/* Textarea container that grows upward */}
      <div className={cn('bg-card/50 max-h-52 flex-1 overflow-y-auto', planMode && 'border-t-primary/30')}>
        {/* Plan mode indicator */}
        {planMode && (
          <div className="bg-background absolute -top-3 right-4 z-10 border px-2">
            <span className="text-primary/70 font-mono text-xs">Planning</span>
          </div>
        )}

        <div className="p-3 pb-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              'w-full resize-none bg-transparent',
              'placeholder:text-muted-foreground focus:outline-none',
              'min-h-11 font-serif'
            )}
            rows={1}
            disabled={disabled || isLoading}
          />
        </div>
      </div>

      {/* Controls at the bottom - always visible */}
      <div className={cn('bg-card/50 border-t transition-all duration-200', planMode && 'border-t-primary/30')}>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            {/* Thinking Level Selector */}
            <Dropdown
              value={thinkingLevel}
              onChange={(value) => setThinkingLevel(value as ThinkingLevel)}
              disabled={isLoading}
              options={[
                {
                  value: 'default',
                  label: 'Default think',
                },
                {
                  value: 'superthink',
                  label: 'Super think',
                },
                {
                  value: 'gigathink',
                  label: 'Giga think',
                },
              ]}
              className="h-7 min-w-32"
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
              className="h-7 w-[70px]"
            />

            {/* Plan Mode Toggle */}
            <button
              className={cn(
                'h-7 border-b px-2 font-mono text-xs transition-colors',
                planMode ? 'bg-accent/30 border-primary/30' : 'hover:bg-accent/20'
              )}
              onClick={() => setPlanMode(!planMode)}
              disabled={isLoading}
            >
              Plan
            </button>
          </div>

          {/* Send/Cancel buttons */}
          <div className="flex items-center gap-1">
            {isLoading && canCancel && onCancel && (
              <button
                onClick={onCancel}
                className="hover:bg-accent/20 h-7 border-b px-3 font-mono text-xs transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={!value.trim() || isLoading}
              className={cn(
                'h-7 border-b px-3 font-mono text-xs transition-colors',
                'hover:bg-accent/30',
                (!value.trim() || isLoading) && 'cursor-not-allowed opacity-50'
              )}
            >
              {isLoading ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
