export type Validator = (value: unknown) => string | null;

export function required(message = 'This field is required'): Validator {
  return (value) => {
    if (value === null || value === undefined) return message;
    if (typeof value === 'string' && value.trim() === '') return message;
    return null;
  };
}

export function email(message = 'Please enter a valid email address'): Validator {
  return (value) => {
    if (!value || typeof value !== 'string') return null;
    if (value.trim() === '') return null;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(value) ? null : message;
  };
}

export function minLength(min: number, message?: string): Validator {
  return (value) => {
    if (!value || typeof value !== 'string') return null;
    if (value.trim() === '') return null;
    return value.length >= min ? null : (message ?? `Must be at least ${min} characters`);
  };
}

export function maxLength(max: number, message?: string): Validator {
  return (value) => {
    if (!value || typeof value !== 'string') return null;
    return value.length <= max ? null : (message ?? `Must be at most ${max} characters`);
  };
}

export function minValue(min: number, message?: string): Validator {
  return (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (isNaN(num)) return 'Must be a number';
    return num >= min ? null : (message ?? `Must be at least ${min}`);
  };
}

export function maxValue(max: number, message?: string): Validator {
  return (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (isNaN(num)) return 'Must be a number';
    return num <= max ? null : (message ?? `Must be at most ${max}`);
  };
}

export function pattern(regex: RegExp, message: string): Validator {
  return (value) => {
    if (!value || typeof value !== 'string') return null;
    if (value.trim() === '') return null;
    return regex.test(value) ? null : message;
  };
}

export function compose(...validators: Validator[]): Validator {
  return (value) => {
    for (const validate of validators) {
      const error = validate(value);
      if (error) return error;
    }
    return null;
  };
}
