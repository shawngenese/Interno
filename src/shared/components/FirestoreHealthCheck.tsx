import { useEffect, useState } from 'react';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { onSnapshot, collection, query, limit } from 'firebase/firestore';

/**
 * Detects Firestore connectivity by listening to a lightweight query.
 * Shows a dismissable banner if Firestore is unreachable.
 *
 * We listen to the `users` collection with a limit(1) — the rules already
 * enforce auth, so a "permission denied" error means Firestore IS connected
 * (just not authorized), while a network error means it's truly unreachable.
 */
export function FirestoreHealthCheck() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      const db = getFirestoreInstancePublic();
      const q = query(collection(db, 'users'), limit(1));

      unsubscribe = onSnapshot(
        q,
        () => {
          // Firestore is reachable — clear any banner.
          setError(null);
        },
        (err) => {
          // Distinguish network errors from permission errors.
          // Permission errors mean Firestore IS connected (rules are working).
          const code = (err as { code?: string }).code ?? '';
          if (code === 'permission-denied' || code === 'unauthenticated') {
            // Connected, just not authorized — not a connectivity issue.
            setError(null);
          } else {
            // Network / unavailable / not-found — Firestore is unreachable.
            setError(err.message || 'Firestore is unreachable');
          }
        },
      );
    } catch {
      setError('Firestore failed to initialize');
    }

    return () => {
      unsubscribe?.();
    };
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
