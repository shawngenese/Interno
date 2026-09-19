import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/features/auth';
import { getSupervisorByUserId } from '@/features/supervisor/services/supervisorService';
import type { Supervisor } from '@/features/admin/types';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: Supervisor | null;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Shared hook that fetches and caches the supervisor record for the current user.
 * Eliminates redundant Firestore reads across supervisor pages.
 */
export function useSupervisor() {
  const { user, role, loading: authLoading } = useAuth();
  const [supervisor, setSupervisor] = useState<Supervisor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!user || role !== 'supervisor') {
      setSupervisor(null);
      setLoading(false);
      return;
    }

    const uid = user.uid;
    const cached = cache.get(uid);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setSupervisor(cached.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const sup = await getSupervisorByUserId(uid);
      if (!mountedRef.current) return;
      cache.set(uid, { data: sup, timestamp: Date.now() });
      setSupervisor(sup);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('Failed to load supervisor:', err);
      setError('Failed to load supervisor profile');
      setSupervisor(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user, role]);

  useEffect(() => {
    mountedRef.current = true;
    if (!authLoading) load();
    return () => { mountedRef.current = false; };
  }, [authLoading, load]);

  const refetch = useCallback(() => {
    if (user?.uid) cache.delete(user.uid);
    load();
  }, [user, load]);

  return { supervisor, loading: authLoading || loading, error, refetch };
}
