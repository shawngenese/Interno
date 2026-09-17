import { useEffect, useState } from 'react';
import { getFirestoreInstancePublic, getAuthInstancePublic } from '@/config/firebase';
import { onSnapshot, collection, query, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * Detects Firestore connectivity by listening to a lightweight query.
 * Shows a dismissable banner if Firestore is unreachable.
 */
export function FirestoreHealthCheck() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    try {
      const auth = getAuthInstancePublic();
      const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        unsubscribeSnapshot?.();
        unsubscribeSnapshot = undefined;

        if (!user) {
          setError(null);
          return;
        }

        try {
          const db = getFirestoreInstancePublic();
          const q = query(collection(db, 'users'), limit(1));

          unsubscribeSnapshot = onSnapshot(
            q,
            () => {
              setError(null);
            },
            (err) => {
              const code = (err as { code?: string }).code ?? '';
              if (code === 'permission-denied' || code === 'unauthenticated') {
                setError(null);
              } else {
                setError(err.message || 'Firestore is unreachable');
              }
            },
          );
        } catch {
          setError('Firestore failed to initialize');
        }
      });

      return () => {
        unsubscribeAuth();
        unsubscribeSnapshot?.();
      };
    } catch {
      return () => {};
    }
  }, []);

  if (!error) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white px-4 py-3 text-center text-sm font-medium shadow-lg"
    >
      Firestore connection issue: {error}
      <button
        onClick={() => setError(null)}
        className="ml-3 underline hover:no-underline"
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}
