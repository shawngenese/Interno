import type { ReactNode } from 'react';

const baseInputClass =
  'w-full px-4 py-3 border rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed';

const defaultBorderClass = 'border-[#BDBDBD] dark:border-[#555555]';
const errorBorderClass = 'border-red-500 dark:border-red-500';

interface FormFieldProps {
  id: string;
  label?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
  description?: string;
}

export function FormField({
  id,
  label,
  required,
  error,
  children,
  className = '',
  description,
}: FormFieldProps) {
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {description && !error && (
        <p className="mt-1 text-xs text-[#757575] dark:text-[#9E9E9E]">{description}</p>
      )}
    </div>
  );
}

interface FormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onBlur'> {
  error?: string;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
}

export function FormInput({ error, onValueChange, onBlur, className = '', ...props }: FormInputProps) {
  const borderClass = error ? errorBorderClass : defaultBorderClass;
  return (
    <input
      {...props}
      onChange={(e) => onValueChange?.(e.target.value)}
      onBlur={onBlur}
      className={`${baseInputClass} ${borderClass} ${className}`}
    />
  );
}

interface FormSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'onBlur'> {
  error?: string;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
}

export function FormSelect({ error, onValueChange, onBlur, children, className = '', ...props }: FormSelectProps) {
  const borderClass = error ? errorBorderClass : defaultBorderClass;
  return (
    <select
      {...props}
      onChange={(e) => onValueChange?.(e.target.value)}
      onBlur={onBlur}
      className={`${baseInputClass} ${borderClass} ${className}`}
    >
      {children}
    </select>
  );
}

interface FormTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'onBlur'> {
  error?: string;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
}

export function FormTextarea({ error, onValueChange, onBlur, className = '', ...props }: FormTextareaProps) {
  const borderClass = error ? errorBorderClass : defaultBorderClass;
  return (
    <textarea
      {...props}
      onChange={(e) => onValueChange?.(e.target.value)}
      onBlur={onBlur}
      className={`${baseInputClass} ${borderClass} ${className}`}
    />
  );
}
