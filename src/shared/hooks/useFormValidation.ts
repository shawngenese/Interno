import { useState, useCallback } from 'react';
import type { Validator } from '../utils/validators';

export type ValidationRules<T> = {
  [K in keyof T]?: Validator[];
};

export interface UseFormValidationReturn<T> {
  formData: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  handleChange: (field: keyof T) => (value: unknown) => void;
  handleBlur: (field: keyof T) => () => void;
  handleSubmit: (onSubmit: (data: T) => void | Promise<void>) => (e: React.FormEvent) => void;
  setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setFieldError: (field: keyof T, error: string) => void;
  clearErrors: () => void;
  setFormData: React.Dispatch<React.SetStateAction<T>>;
}

export function useFormValidation<T extends object>(
  initialValues: T,
  rules: ValidationRules<T>,
): UseFormValidationReturn<T> {
  const [formData, setFormData] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const validateField = useCallback(
    (field: keyof T, value: unknown): string | null => {
      const fieldRules = rules[field];
      if (!fieldRules) return null;
      for (const validate of fieldRules) {
        const error = validate(value);
        if (error) return error;
      }
      return null;
    },
    [rules],
  );

  const validateAll = useCallback((): Partial<Record<keyof T, string>> => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let hasError = false;

    for (const field of Object.keys(rules) as (keyof T)[]) {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        hasError = true;
      }
    }

    return hasError ? newErrors : {};
  }, [rules, formData, validateField]);

  const handleChange = useCallback(
    (field: keyof T) => (value: unknown) => {
      setFormData((prev) => ({ ...prev, [field]: value as T[keyof T] }));
      const error = validateField(field, value);
      setErrors((prev) => {
        if (error) return { ...prev, [field]: error };
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [validateField],
  );

  const handleBlur = useCallback(
    (field: keyof T) => () => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const error = validateField(field, formData[field]);
      setErrors((prev) => {
        if (error) return { ...prev, [field]: error };
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [validateField, formData],
  );

  const handleSubmit = useCallback(
    (onSubmit: (data: T) => void | Promise<void>) => async (e: React.FormEvent) => {
      e.preventDefault();

      const allTouched: Partial<Record<keyof T, boolean>> = {};
      for (const field of Object.keys(formData) as (keyof T)[]) {
        allTouched[field] = true;
      }
      setTouched(allTouched);

      const newErrors = validateAll();
      setErrors(newErrors);

      if (Object.keys(newErrors).length === 0) {
        await onSubmit(formData);
      }
    },
    [formData, validateAll],
  );

  const setFieldValue = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      const error = validateField(field, value);
      setErrors((prev) => {
        if (error) return { ...prev, [field]: error };
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [validateField],
  );

  const setFieldError = useCallback((field: keyof T, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const isValid = Object.keys(errors).length === 0;

  return {
    formData,
    errors,
    touched,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFieldError,
    clearErrors,
    setFormData,
  };
}
