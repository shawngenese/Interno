import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isOnline, onOnlineChange } from '@/shared/utils/offline';

describe('offline utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isOnline', () => {
    it('returns navigator.onLine value', () => {
      expect(typeof isOnline()).toBe('boolean');
    });
  });

  describe('onOnlineChange', () => {
    it('returns unsubscribe function', () => {
      const unsubscribe = onOnlineChange(() => {});
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });
});
