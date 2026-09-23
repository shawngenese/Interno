import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children?: React.ReactNode;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:     'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-hover',
  secondary:   'bg-transparent text-primary border border-primary hover:bg-primary-light',
  destructive: 'bg-destructive text-on-destructive hover:bg-destructive-hover active:bg-destructive-hover',
  ghost:       'bg-transparent text-foreground hover:bg-muted',
  accent:      'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-hover',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-(--btn-height) px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      disabled={isDisabled}
      aria-disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-md font-medium',
        'transition-[background-color,border-color,opacity,transform] duration-150 ease-out',
        'active:scale-[0.97]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {isLoading && (
        <svg
          className="h-4 w-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}