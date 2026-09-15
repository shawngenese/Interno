import { useState, useEffect, useCallback, useRef } from 'react';

const DRAFT_PREFIX = 'form_draft_';
const DRAFT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface DraftData<T> {
  data: T;
  timestamp: number;
}

/** Save form draft to localStorage. */
export function saveFormDraft<T>(key: string, data: T): void {
  try {
    const draft: DraftData<T> = { data, timestamp: Date.now() };
    localStorage.setItem(`${DRAFT_PREFIX}${key}`, JSON.stringify(draft));
  } catch (err) {
    console.error('Failed to save form draft:', err);
  }
}

/** Load form draft from localStorage. Returns null if expired or not found. */
export function loadFormDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${key}`);
    if (!raw) return null;

    const draft: DraftData<T> = JSON.parse(raw);
    if (Date.now() - draft.timestamp > DRAFT_EXPIRY) {
      localStorage.removeItem(`${DRAFT_PREFIX}${key}`);
      return null;
    }

    return draft.data;
  } catch {
    return null;
  }
}

/** Remove form draft from localStorage. */
export function removeFormDraft(key: string): void {
  localStorage.removeItem(`${DRAFT_PREFIX}${key}`);
}

/** Hook for managing form drafts with auto-save. */
export function useFormDraft<T>(
  formKey: string,
  initialValues: T,
  options?: {
    autoSaveInterval?: number;
    enabled?: boolean;
  },
): {
  values: T;
  setValue: (key: keyof T, value: T[keyof T]) => void;
  setValues: (values: Partial<T>) => void;
  saveDraft: () => void;
  clearDraft: () => void;
  hasDraft: boolean;
  lastSaved: Date | null;
} {
  const [values, setValuesState] = useState<T>(() => {
    const saved = loadFormDraft<T>(formKey);
    return saved || initialValues;
  });
  const [hasDraft, setHasDraft] = useState(() => loadFormDraft<T>(formKey) !== null);
  const [lastSaved, setLastSaved] = useState<Date | null>(() => {
    const saved = localStorage.getItem(`${DRAFT_PREFIX}${formKey}`);
    if (saved) {
      const draft: DraftData<T> = JSON.parse(saved);
      return new Date(draft.timestamp);
    }
    return null;
  });

  const saveDraftRef = useRef<() => void>(() => {});

  const saveDraft = useCallback(() => {
    saveFormDraft(formKey, values);
    setLastSaved(new Date());
    setHasDraft(true);
  }, [formKey, values]);

  const valuesRef = useRef(values);

  useEffect(() => {
    saveDraftRef.current = saveDraft;
    valuesRef.current = values;
  });

  const clearDraft = useCallback(() => {
    removeFormDraft(formKey);
    setHasDraft(false);
    setLastSaved(null);
  }, [formKey]);

  const setValue = useCallback((key: keyof T, value: T[keyof T]) => {
    setValuesState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...newValues }));
  }, []);

  // Auto-save — stable interval that reads latest values/saveDraft via refs
  useEffect(() => {
    if (options?.enabled === false) return;

    const interval = setInterval(() => {
      const current = valuesRef.current;
      if (current && Object.keys(current).length > 0) {
        saveDraftRef.current();
      }
    }, options?.autoSaveInterval || 30000);

    return () => clearInterval(interval);
  }, [formKey, options?.enabled, options?.autoSaveInterval]);

  return { values, setValue, setValues, saveDraft, clearDraft, hasDraft, lastSaved };
}
