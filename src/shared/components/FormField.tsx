import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

// Base input class — used by FormInput, FormSelect, FormTextarea
export const inputBaseClass =
  'w-full h-(--input-height) px-3 border border-input rounded-md bg-card text-foreground text-base ' +
  'placeholder:text-muted-foreground ' +
  'focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 ' +
  'transition-colors duration-150 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

interface FormFieldProps {
  id: string;
  label?: string;
  required?: boolean;
  error?: string;
  success?: boolean;
  children: ReactNode;
  className?: string;
  description?: string;
}

export function FormField({
  id,
  label,
  required,
  error,
  success,
  children,
  className = '',
  description,
}: FormFieldProps) {
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-foreground mb-1"
        >
          {label}{' '}
          {required && (
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {children}

      {error && (
        <p
          role="alert"
          className="mt-1 flex items-center gap-1 text-xs text-destructive"
        >
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}

      {success && !error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-success">
          <CheckCircle size={14} aria-hidden="true" />
          Looks good
        </p>
      )}

      {description && !error && !success && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

// ─── FormInput ───────────────────────────────────────────────────────────────

interface FormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onBlur'> {
  error?: string;
  success?: boolean;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
}

export function FormInput({ error, success, onValueChange, onBlur, className = '', ...props }: FormInputProps) {
  const borderOverride = error
    ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
    : success
    ? 'border-success focus:border-success focus:ring-success/20'
    : '';

  return (
    <input
      {...props}
      onChange={(e) => onValueChange?.(e.target.value)}
      onBlur={onBlur}
      aria-invalid={error ? 'true' : undefined}
      className={`${inputBaseClass} ${borderOverride} ${className}`}
    />
  );
}

// ─── FormSelect ──────────────────────────────────────────────────────────────

interface FormSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'onBlur'> {
  error?: string;
  success?: boolean;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
}

export function FormSelect({ error, success, onValueChange, onBlur, children, className = '', ...props }: FormSelectProps) {
  const borderOverride = error
    ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
    : success
    ? 'border-success focus:border-success focus:ring-success/20'
    : '';

  return (
    <select
      {...props}
      onChange={(e) => onValueChange?.(e.target.value)}
      onBlur={onBlur}
      aria-invalid={error ? 'true' : undefined}
      className={`${inputBaseClass} ${borderOverride} ${className}`}
    >
      {children}
    </select>
  );
}

// ─── FormTextarea ─────────────────────────────────────────────────────────────

interface FormTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'onBlur'> {
  error?: string;
  success?: boolean;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
}

export function FormTextarea({ error, success, onValueChange, onBlur, className = '', ...props }: FormTextareaProps) {
  const borderOverride = error
    ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
    : success
    ? 'border-success focus:border-success focus:ring-success/20'
    : '';

  // Remove h-(--input-height) for textarea — it needs auto height
  const textareaBase = inputBaseClass.replace('h-(--input-height) ', '');

  return (
    <textarea
      {...props}
      onChange={(e) => onValueChange?.(e.target.value)}
      onBlur={onBlur}
      aria-invalid={error ? 'true' : undefined}
      className={`${textareaBase} min-h-[80px] py-2 resize-y ${borderOverride} ${className}`}
    />
  );
}
