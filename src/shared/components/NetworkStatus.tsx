import { useState, useEffect, useCallback } from 'react';
import { onOnlineChange, getPendingMutations, syncPendingMutations, cleanupSyncedMutations } from '@/shared/utils/offline';

/**
 * Full-featured network status indicator with pending mutations counter and sync button.
 */
export function NetworkStatusIndicator({ className = '', showWhenOnline = true }: { className?: string; showWhenOnline?: boolean }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const doRefreshPending = useCallback(async () => {
    try {
      const pending = await getPendingMutations();
      setPendingCount(pending.length);
    } catch (err) {
      console.error('Failed to get pending count:', err);
    }
  }, []);

  const handleSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const result = await syncPendingMutations();
      console.log('[NetworkStatus] Sync result:', result);
      await doRefreshPending();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }, [doRefreshPending]);

  useEffect(() => {
    const unsubscribe = onOnlineChange(setOnline);
    doRefreshPending();

    const cleanupInterval = setInterval(() => {
      cleanupSyncedMutations().catch(console.error);
    }, 24 * 60 * 60 * 1000);

    return () => {
      unsubscribe();
      clearInterval(cleanupInterval);
    };
  }, [doRefreshPending]);

  if (!online && !showWhenOnline) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {online ? 'Online' : 'Offline'}
        </span>
      </div>

      {pendingCount > 0 && (
        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-full flex items-center gap-1">
          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>{pendingCount} pending</span>
        </span>
      )}

      {(pendingCount > 0 || !online) && (
        <button
          onClick={handleSync}
          disabled={syncing || !navigator.onLine}
          className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          aria-label={syncing ? 'Syncing...' : online ? 'Sync pending changes' : 'Waiting for connection'}
        >
          {online ? (
            <>
              <svg className={syncing ? 'animate-spin h-3 w-3' : 'h-3 w-3'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync
            </>
          ) : (
            'Waiting for connection...'
          )}
        </button>
      )}
    </div>
  );
}

/** Compact version for header. */
export function NetworkStatusCompact() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const unsubscribe = onOnlineChange(setOnline);
    return unsubscribe;
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
    </div>
  );
}

/** Full offline banner for top of app. */
export function OfflineBanner({ onDismiss }: { onDismiss?: () => void }) {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const unsubscribe = onOnlineChange(setOnline);
    return unsubscribe;
  }, []);

  if (online) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/30 border-b border-yellow-200 dark:border-yellow-800">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m0 5.656l3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span className="font-medium text-yellow-800 dark:text-yellow-200">You're offline</span>
        </div>
        <div className="text-sm text-yellow-700 dark:text-yellow-300">
          Changes will be saved locally and synced when connection is restored.
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-sm text-yellow-600 dark:text-yellow-400 hover:underline">
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}