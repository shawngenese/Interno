import { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface DiagnosticResult {
  label: string;
  status: 'ok' | 'warn' | 'error';
  detail: string;
}

export function SupervisorDiagnostic() {
  const { user } = useAuth();
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const run = async () => {
      setRunning(true);
      const r: DiagnosticResult[] = [];
      const db = getFirestoreInstancePublic();

      // 1. Auth UID
      r.push({ label: 'Auth UID', status: 'ok', detail: user.uid });

      // 2. Custom claims
      try {
        const token = await user.getIdTokenResult(true);
        const role = (token.claims as Record<string, unknown>).role;
        r.push({
          label: 'Custom Claims Role',
          status: role ? 'ok' : 'error',
          detail: role ? String(role) : 'NOT SET (missing from ID token)',
        });
      } catch (e) {
        r.push({ label: 'Custom Claims Role', status: 'error', detail: String(e) });
      }

      // 3. users/{uid} doc
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          r.push({
            label: 'users/' + user.uid,
            status: data.role ? 'ok' : 'warn',
            detail: JSON.stringify({ role: data.role, companyId: data.companyId, departmentId: data.departmentId }),
          });
        } else {
          r.push({ label: 'users/' + user.uid, status: 'error', detail: 'DOCUMENT DOES NOT EXIST' });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        r.push({ label: 'users/' + user.uid, status: 'error', detail: 'READ FAILED: ' + msg });
      }

      // 4. supervisors/{uid} doc
      try {
        const snap = await getDoc(doc(db, 'supervisors', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          r.push({
            label: 'supervisors/' + user.uid,
            status: 'ok',
            detail: JSON.stringify({ userId: data.userId, companyId: data.companyId, assignedTrainees: data.assignedTrainees }),
          });
        } else {
          r.push({ label: 'supervisors/' + user.uid, status: 'error', detail: 'DOCUMENT DOES NOT EXIST' });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        r.push({ label: 'supervisors/' + user.uid, status: 'error', detail: 'READ FAILED: ' + msg });
      }

      // 5. Query trainees by supervisorId
      try {
        const q = query(collection(db, 'trainees'), where('supervisorId', '==', user.uid));
        const snap = await getDocs(q);
        const trainees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        r.push({
          label: 'Query: trainees where supervisorId == ' + user.uid.slice(0, 8) + '...',
          status: 'ok',
          detail: snap.size + ' doc(s) found' + (trainees.length > 0 ? ': ' + trainees.map((t: Record<string, unknown>) => t.id).join(', ') : ''),
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        r.push({ label: 'Query: trainees by supervisorId', status: 'error', detail: 'QUERY FAILED: ' + msg });
      }

      // 6. assignedTrainees subcollection
      try {
        const snap = await getDocs(collection(db, 'supervisors', user.uid, 'assignedTrainees'));
        r.push({
          label: 'Subcollection: supervisors/' + user.uid.slice(0, 8) + '/assignedTrainees',
          status: snap.size > 0 ? 'ok' : 'warn',
          detail: snap.size + ' doc(s)' + (snap.size === 0 ? ' (EMPTY - no subcollection docs)' : ''),
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        r.push({ label: 'Subcollection: assignedTrainees', status: 'error', detail: 'READ FAILED: ' + msg });
      }

      // 7. Force-refresh token and re-check claims
      try {
        await user.getIdToken(true);
        const token2 = await user.getIdTokenResult(false);
        const role2 = (token2.claims as Record<string, unknown>).role;
        r.push({
          label: 'Claims after refresh',
          status: role2 ? 'ok' : 'error',
          detail: role2 ? String(role2) : 'Still NOT SET after forced refresh',
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        r.push({ label: 'Claims after refresh', status: 'error', detail: msg });
      }

      if (!cancelled) {
        setResults(r);
        setRunning(false);
        console.table(r);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-bold text-yellow-800 dark:text-yellow-300 mb-2">
        DIAGNOSTIC (temporary - remove after debugging)
      </h3>
      {running ? (
        <p className="text-sm text-[#555555] dark:text-[#9E9E9E]">Running diagnostics...</p>
      ) : (
        <div className="space-y-1">
          {results.map((r, i) => (
            <div key={i} className="text-xs font-mono flex gap-2">
              <span className={r.status === 'ok' ? 'text-green-600' : r.status === 'warn' ? 'text-yellow-600' : 'text-red-600'}>
                {r.status === 'ok' ? '[OK]' : r.status === 'warn' ? '[WARN]' : '[FAIL]'}
              </span>
              <span className="font-bold text-[#3A3A3A] dark:text-[#BDBDBD]">{r.label}:</span>
              <span className="text-[#555555] dark:text-[#9E9E9E] break-all">{r.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
