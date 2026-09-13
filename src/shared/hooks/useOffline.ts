import { useState, useEffect, useCallback } from 'react';
import { onOnlineChange, getPendingMutations, syncPendingMutations, saveOfflineMutation } from '../utils/offline';

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

  const sync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncPendingMutations();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  return { syncing, sync };
}

/** Hook for saving mutations with offline fallback. */
export function useOfflineWrite<T>(
  onlineWrite: () => Promise<T>,
  offlineFallback: { type: 'create' | 'update' | 'delete'; collection: string; docId: string; data?: Record<string, unknown> },
): { execute: () => Promise<T>; pending: boolean } {
  const [pending, setPending] = useState(false);

  const execute = useCallback(async () => {
    setPending(true);
    try {
      if (navigator.onLine) {
        try {
          return await onlineWrite();
        } catch (err) {
          console.warn('Online write failed, queuing offline:', err);
          await saveOfflineMutation(offlineFallback.type, offlineFallback.collection, offlineFallback.docId, offlineFallback.data);
          throw err;
        }
      } else {
        await saveOfflineMutation(offlineFallback.type, offlineFallback.collection, offlineFallback.docId, offlineFallback.data);
        throw new Error('Offline - mutation queued for sync');
      }
    } finally {
      setPending(false);
    }
  }, [onlineWrite, offlineFallback]);

  return { execute, pending };
}