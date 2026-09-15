import { describe, it, expect, beforeEach } from 'vitest';
import { saveFormDraft, loadFormDraft, removeFormDraft } from '@/shared/hooks/useFormDraft';

describe('useFormDraft', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('saveFormDraft', () => {
    it('saves draft to localStorage', () => {
      saveFormDraft('test-form', { name: 'John', email: 'john@test.com' });
      const raw = localStorage.getItem('form_draft_test-form');
      expect(raw).toBeTruthy();
      const draft = JSON.parse(raw!);
      expect(draft.data.name).toBe('John');
      expect(draft.timestamp).toBeTypeOf('number');
    });
  });

  describe('loadFormDraft', () => {
    it('loads saved draft', () => {
      saveFormDraft('test-form', { name: 'John' });
      const loaded = loadFormDraft<{ name: string }>('test-form');
      expect(loaded).toEqual({ name: 'John' });
    });

    it('returns null for non-existent draft', () => {
      const loaded = loadFormDraft('non-existent');
      expect(loaded).toBeNull();
    });

    it('returns null for expired draft', () => {
      const expiredDraft = {
        data: { name: 'John' },
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      };
      localStorage.setItem('form_draft_test-form', JSON.stringify(expiredDraft));

      const loaded = loadFormDraft('test-form');
      expect(loaded).toBeNull();
    });
  });

  describe('removeFormDraft', () => {
    it('removes draft from localStorage', () => {
      saveFormDraft('test-form', { name: 'John' });
      removeFormDraft('test-form');
      const loaded = loadFormDraft('test-form');
      expect(loaded).toBeNull();
    });
  });
});
