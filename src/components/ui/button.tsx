import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center font-mono text-sm whitespace-nowrap transition-all focus:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-foreground/20 hover:bg-accent/30 hover:border-foreground/40 border-b',
        destructive: 'border-destructive/30 text-destructive hover:bg-destructive/10 border-b',
        outline: 'border-input hover:bg-accent/20 border bg-transparent',
        secondary: 'bg-secondary/50 hover:bg-secondary/70',
        ghost: 'hover:bg-accent/20',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-3 py-2',
        sm: 'h-8 px-2 text-xs',
        lg: 'h-10 px-4',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} type={type} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
