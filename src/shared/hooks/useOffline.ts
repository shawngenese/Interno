import { useState, useEffect, useCallback, useRef } from 'react';
import { onOnlineChange, getPendingMutations, syncPendingMutations, queueOfflineMutation } from '../utils/offline';

/** Hook for online/offline status. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const unsubscribe = onOnlineChange(setOnline);
    return unsubscribe;
  }, []);

  return online;
}

/** Hook for pending offline mutations count. */
export function usePendingMutations(): { count: number; refresh: () => Promise<void> } {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const pending = await getPendingMutations();
      setCount(pending.length);
    } catch (err) {
      console.error('Failed to get pending count:', err);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Refresh every 30 seconds
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { count, refresh };
}

/** Hook for syncing pending mutations. */
export function useSyncMutations(): { syncing: boolean; sync: () => Promise<void> } {
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await syncPendingMutations();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  return { syncing, sync };
}

/** Hook for saving mutations with offline fallback. */
export function useOfflineWrite<T>(
  onlineWrite: () => Promise<T>,
  offlineFallback: { type: 'create' | 'update' | 'delete'; collection: string; docId: string; data?: Record<string, unknown> },
): { execute: () => Promise<T>; pending: boolean } {
  const [pending, setPending] = useState(false);
  const onlineWriteRef = useRef(onlineWrite);
  const offlineFallbackRef = useRef(offlineFallback);
  onlineWriteRef.current = onlineWrite;
  offlineFallbackRef.current = offlineFallback;

  const execute = useCallback(async () => {
    setPending(true);
    try {
      if (navigator.onLine) {
        try {
          return await onlineWriteRef.current();
        } catch (err) {
          console.warn('Online write failed, queuing offline:', err);
          await queueOfflineMutation(offlineFallbackRef.current);
          throw err;
        }
      } else {
        await queueOfflineMutation(offlineFallbackRef.current);
        throw new Error('Offline - mutation queued for sync');
      }
    } finally {
      setPending(false);
    }
  }, []);

  return { execute, pending };
}