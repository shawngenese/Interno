import { getFirestoreInstancePublic, enableOfflineSupport, disableOfflineSupport, enableOnlineSupport } from '@/config/firebase';

/** Offline queue item. */
export interface OfflineQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: string;
  docId?: string;
  data?: Record<string, unknown>;
  timestamp: number;
  retries: number;
  synced: boolean;
}

/** Check if browser is online. */
export function isOnline(): boolean {
  return navigator.onLine;
}

/** Listen for online/offline events. */
export function onOnlineChange(callback: (online: boolean) => void): () => void {
  const handler = () => callback(navigator.onLine);
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
}

/** Enable Firestore offline persistence (already done in firebase.ts, exposed here for manual control). */
export async function enablePersistence(): Promise<void> {
  try {
    await enableOfflineSupport();
    console.log('[Offline] Persistence enabled');
  } catch (err) {
    console.error('[Offline] Failed to enable persistence:', err);
    throw err;
  }
}

/** Disable offline persistence. */
export async function disablePersistence(): Promise<void> {
  try {
    await disableOfflineSupport();
    console.log('[Offline] Persistence disabled');
  } catch (err) {
    console.error('[Offline] Failed to disable persistence:', err);
    throw err;
  }
}

/** Force network enable/disable (for testing). */
export async function setNetworkEnabled(enabled: boolean): Promise<void> {
  if (enabled) await enableOnlineSupport();
  else await disableOfflineSupport();
}

/** Offline queue using IndexedDB (simple wrapper). */
const QUEUE_DB = 'offline_queue';
const QUEUE_STORE = 'items';

async function openQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(QUEUE_DB, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      }
    };
  });
}

/** Add mutation to offline queue. */
export async function queueOfflineMutation(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retries' | 'synced'>): Promise<string> {
  const db = await openQueueDB();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const fullItem: OfflineQueueItem = {
    ...item,
    id,
    timestamp: Date.now(),
    retries: 0,
    synced: false,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).add(fullItem);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

/** Get all pending offline mutations. */
export async function getPendingMutations(): Promise<OfflineQueueItem[]> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const request = tx.objectStore(QUEUE_STORE).getAll();
    request.onsuccess = () => resolve(request.result.filter(i => !i.synced));
    request.onerror = () => reject(request.error);
  });
}

/** Mark mutation as synced. */
export async function markMutationSynced(id: string): Promise<void> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (item) {
        item.synced = true;
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/** Remove synced mutations older than maxAge. */
export async function cleanupSyncedMutations(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const db = await openQueueDB();
  const cutoff = Date.now() - maxAgeMs;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      let count = 0;
      for (const item of request.result) {
        if (item.synced && item.timestamp < cutoff) {
          store.delete(item.id);
          count++;
        }
      }
      tx.oncomplete = () => resolve(count);
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

/** Sync pending mutations when back online. */
export async function syncPendingMutations(): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const pending = await getPendingMutations();
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const { doc, setDoc, updateDoc, deleteDoc } = await import('firebase/firestore');

      if (item.type === 'create') {
        await setDoc(doc(getFirestoreInstancePublic(), item.collection, item.docId || ''), item.data ?? {});
      } else if (item.type === 'update') {
        await updateDoc(doc(getFirestoreInstancePublic(), item.collection, item.docId || ''), item.data ?? {});
      } else if (item.type === 'delete') {
        await deleteDoc(doc(getFirestoreInstancePublic(), item.collection, item.docId || ''));
      }
      await markMutationSynced(item.id);
      synced++;
    } catch (err) {
      console.error('[Offline] Sync failed for item:', item.id, err);
      failed++;
    }
  }

  return { synced, failed };
}

/** Save mutation to offline queue (for use in services). */
export async function saveOfflineMutation(
  type: 'create' | 'update' | 'delete',
  collection: string,
  docId: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (navigator.onLine) return; // Don't queue if online

  await queueOfflineMutation({
    type,
    collection,
    docId,
    data,
  });
}

/** Wrap Firestore write with offline queue fallback. */
export async function writeWithOfflineFallback<T>(
  onlineWrite: () => Promise<T>,
  offlineFallback: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retries' | 'synced'>,
): Promise<T> {
  if (navigator.onLine) {
    try {
      return await onlineWrite();
    } catch (err) {
      // If online write fails, queue for later
      console.warn('[Offline] Online write failed, queuing:', err);
      await queueOfflineMutation(offlineFallback);
      throw err;
    }
  } else {
    // Offline: queue immediately
    await queueOfflineMutation(offlineFallback);
    throw new Error('Offline - mutation queued for sync');
  }
}