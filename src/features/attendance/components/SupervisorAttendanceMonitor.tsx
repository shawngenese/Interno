import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSupervisor } from '@/shared/hooks/useSupervisor';
import { getAssignedTrainees } from '@/features/supervisor/services/supervisorService';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs } from 'firebase/firestore';
import { formatTime12 } from '@/shared/utils/dateUtils';
import { Skeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { Button } from '@/shared/components/ui/Button';
import { Users, UserCheck, AlertTriangle, Activity } from 'lucide-react';

interface TraineeAttendanceStatus {
  traineeId: string;
  traineeName: string;
  hasTimeIn: boolean;
  hasTimeOut: boolean;
  timeInTime?: string;
  timeOutTime?: string;
  lastScanTime?: number;
}

export function SupervisorAttendanceMonitor() {
  const { user } = useAuth();
  const { supervisor, loading: supLoading } = useSupervisor();
  const [statuses, setStatuses] = useState<TraineeAttendanceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const unsubscribeRef = useRef<(() => void)[]>([]);

  const cleanup = useCallback(() => {
    unsubscribeRef.current.forEach((unsub) => unsub());
    unsubscribeRef.current = [];
  }, []);

  useEffect(() => {
    if (!user?.uid || supLoading || !supervisor) {
      if (!supLoading) setLoading(false);
      return;
    }

    let mounted = true;

    async function setup() {
      try {
        setError(null);
        const trainees = await getAssignedTrainees(supervisor!.id, supervisor!.companyId);
        if (!mounted) return;

        const db = getFirestoreInstancePublic();

        const traineeNames: Record<string, string> = {};
        const userIds = [...new Set(trainees.map((t) => t.userId))];
        const CHUNK_SIZE = 30;

        for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
          const chunk = userIds.slice(i, i + CHUNK_SIZE);
          const usersQuery = query(collection(db, 'users'), where('__name__', 'in', chunk));
          const usersSnap = await getDocs(usersQuery);
          usersSnap.forEach((docSnap) => {
            const data = docSnap.data();
            const name = data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || docSnap.id;
            const matched = trainees.find((t) => t.userId === docSnap.id);
            if (matched) {
              traineeNames[matched.id] = name;
            }
          });
        }

        for (const t of trainees) {
          if (!(t.id in traineeNames)) {
            traineeNames[t.id] = t.id;
          }
        }

        if (!mounted) return;

        const initialStatuses: TraineeAttendanceStatus[] = trainees.map((t) => ({
          traineeId: t.id,
          traineeName: traineeNames[t.id],
          hasTimeIn: false,
          hasTimeOut: false,
        }));
        setStatuses(initialStatuses);

        cleanup();

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();

        for (const trainee of trainees) {
          const q = query(
            collection(db, 'attendance_records'),
            where('traineeId', '==', trainee.id),
            where('timestamp', '>=', todayStart),
            where('timestamp', '<', todayEnd),
            orderBy('timestamp', 'desc'),
            limit(10),
          );

          const unsub = onSnapshot(q, (snapshot) => {
            const records = snapshot.docs.map((d) => d.data());
            const hasTimeIn = records.some((r) => r.type === 'time_in');
            const hasTimeOut = records.some((r) => r.type === 'time_out');
            const timeInRec = records.find((r) => r.type === 'time_in');
            const timeOutRec = records.find((r) => r.type === 'time_out');

            setStatuses((prev) =>
              prev.map((s) =>
                s.traineeId === trainee.id
                  ? {
                      ...s,
                      hasTimeIn,
                      hasTimeOut,
                      timeInTime: timeInRec ? formatTime12(timeInRec.timestamp) : undefined,
                      timeOutTime: timeOutRec ? formatTime12(timeOutRec.timestamp) : undefined,
                      lastScanTime: records[0]?.timestamp,
                    }
                  : s
              )
            );
          });

          unsubscribeRef.current.push(unsub);
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to setup attendance monitor:', err);
        setError('Failed to load attendance data. Please try again.');
        setLoading(false);
      }
    }

    setup();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [user?.uid, supLoading, supervisor, cleanup, retryKey]);

  const allTimedIn = statuses.filter((s) => s.hasTimeIn);
  const missingTimeOut = statuses.filter((s) => s.hasTimeIn && !s.hasTimeOut);

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Attendance Monitor</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-6">Real-time attendance status of assigned trainees.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-1">
              <Users className="w-4 h-4" /> Total Assigned
            </div>
            <p className="text-2xl font-bold text-foreground">{statuses.length}</p>
          </div>
          <div className="p-4 bg-success/10 border border-success/20 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-success mb-1">
              <UserCheck className="w-4 h-4" /> Timed In
            </div>
            <p className="text-2xl font-bold text-foreground">{allTimedIn.length}</p>
          </div>
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-warning mb-1">
              <AlertTriangle className="w-4 h-4" /> Missing Time Out
            </div>
            <p className="text-2xl font-bold text-foreground">{missingTimeOut.length}</p>
          </div>
        </div>

        {missingTimeOut.length > 0 && (
          <div role="alert" className="mb-6 p-4 bg-warning/10 border border-warning/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              <p className="text-sm font-bold text-warning">
                {missingTimeOut.length} trainee(s) have not timed out yet
              </p>
            </div>
            <ul className="list-disc list-inside text-xs text-warning/90 space-y-0.5 ml-1">
              {missingTimeOut.map((s) => (
                <li key={s.traineeId}>{s.traineeName} (timed in at {s.timeInTime})</li>
              ))}
            </ul>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="rectangular" height={52} className="rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="secondary"
              onClick={() => { setError(null); setRetryKey(k => k + 1); }}
            >
              Retry
            </Button>
          </div>
        ) : statuses.length === 0 ? (
          <EmptyState
            title="No assigned trainees"
            description="Contact your coordinator to assign trainees to your supervision."
          />
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {statuses.map((status) => (
                <div key={status.traineeId} className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {status.traineeName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="font-semibold text-sm text-foreground">{status.traineeName}</span>
                    </div>
                    {status.hasTimeIn && status.hasTimeOut ? (
                      <span className="px-2.5 py-0.5 text-xs font-semibold bg-success/15 text-success rounded-full border border-success/20">
                        Complete
                      </span>
                    ) : status.hasTimeIn ? (
                      <span className="px-2.5 py-0.5 text-xs font-semibold bg-warning/15 text-warning rounded-full border border-warning/20">
                        Timed In
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground rounded-full border border-border">
                        Not Started
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border">
                    <div>
                      <span className="text-muted-foreground">Time In:</span>{' '}
                      <span className="font-semibold text-foreground">{status.timeInTime || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time Out:</span>{' '}
                      <span className="font-semibold text-foreground">{status.timeOutTime || '—'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="h-[44px] text-left py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Trainee</th>
                    <th className="h-[44px] text-center py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="h-[44px] text-center py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Time In</th>
                    <th className="h-[44px] text-center py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Time Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {statuses.map((status) => (
                    <tr key={status.traineeId} className="h-[44px] hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                            {status.traineeName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </div>
                          <span className="font-medium text-foreground">{status.traineeName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {status.hasTimeIn && status.hasTimeOut ? (
                          <span className="px-2.5 py-0.5 text-xs font-semibold bg-success/15 text-success rounded-full border border-success/20">
                            Complete
                          </span>
                        ) : status.hasTimeIn ? (
                          <span className="px-2.5 py-0.5 text-xs font-semibold bg-warning/15 text-warning rounded-full border border-warning/20">
                            Timed In
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground rounded-full border border-border">
                            Not Started
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-muted-foreground">
                        {status.timeInTime || '—'}
                      </td>
                      <td className="py-3 px-4 text-center text-muted-foreground">
                        {status.timeOutTime || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

