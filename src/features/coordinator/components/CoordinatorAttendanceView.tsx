import { useState, useEffect, useCallback } from 'react';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs, doc, getDoc, documentId } from 'firebase/firestore';
import { useAuth } from '@/features/auth';
import { formatTime12 } from '@/shared/utils/dateUtils';

interface TraineeAttendance {
  traineeId: string;
  traineeName: string;
  hasTimeIn: boolean;
  hasTimeOut: boolean;
  timeInTime?: number;
  timeOutTime?: number;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function CoordinatorAttendanceView() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<TraineeAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAttendance = useCallback(async (signal?: AbortSignal) => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const db = getFirestoreInstancePublic();

      // Resolve coordinator's companyId
      const coordSnap = await getDoc(doc(db, 'coordinators', user.uid));
      if (!coordSnap.exists()) {
        if (!signal?.aborted) { setAttendance([]); setLoading(false); }
        return;
      }
      const companyId = coordSnap.data().companyId as string;
      if (!companyId) {
        if (!signal?.aborted) { setAttendance([]); setLoading(false); }
        return;
      }

      // Get trainees in company
      const traineeSnap = await getDocs(
        query(collection(db, 'trainees'), where('companyId', '==', companyId)),
      );
      if (signal?.aborted) return;

      // Resolve names from users collection
      const userIds = [...new Set(traineeSnap.docs.map((d) => d.data().userId).filter(Boolean))];
      const userMap = new Map<string, string>();
      for (const batch of chunkArray(userIds, 30)) {
        const userSnap = await getDocs(
          query(collection(db, 'users'), where('companyId', '==', companyId), where(documentId(), 'in', batch)),
        );
        if (signal?.aborted) return;
        userSnap.docs.forEach((doc) => {
          userMap.set(doc.id, (doc.data().displayName as string) || 'Unknown');
        });
      }

      const traineeMap = new Map<string, string>();
      for (const t of traineeSnap.docs) {
        const data = t.data();
        const name = data.name || userMap.get(data.userId) || 'Unknown';
        traineeMap.set(t.id, name);
      }

      const traineeIds = [...traineeMap.keys()];
      if (traineeIds.length === 0) {
        if (!signal?.aborted) { setAttendance([]); setLoading(false); }
        return;
      }

      // Get today's attendance
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayMs = today.getTime();

      const result: TraineeAttendance[] = traineeIds.map((id) => ({
        traineeId: id,
        traineeName: traineeMap.get(id) || 'Unknown',
        hasTimeIn: false,
        hasTimeOut: false,
      }));

      // Query in batches of 30 (Firestore `in` limit)
      for (let i = 0; i < traineeIds.length; i += 30) {
        const batch = traineeIds.slice(i, i + 30);
        const attSnap = await getDocs(
          query(
            collection(db, 'attendance_records'),
            where('traineeId', 'in', batch),
            where('timestamp', '>=', todayMs),
          ),
        );
        if (signal?.aborted) return;

        for (const doc of attSnap.docs) {
          const data = doc.data();
          const tid = data.traineeId as string;
          const entry = result.find((r) => r.traineeId === tid);
          if (entry) {
            if (data.type === 'time_in' && !entry.hasTimeIn) {
              entry.hasTimeIn = true;
              entry.timeInTime = data.timestamp;
            }
            if (data.type === 'time_out' && !entry.hasTimeOut) {
              entry.hasTimeOut = true;
              entry.timeOutTime = data.timestamp;
            }
          }
        }
      }

      if (!signal?.aborted) setAttendance(result);
    } catch (err) {
      if (!signal?.aborted) {
        console.error('Failed to load attendance:', err);
        setError('Failed to load attendance');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();
    loadAttendance(controller.signal);
    return () => controller.abort();
  }, [loadAttendance]);

  const timedInCount = attendance.filter((a) => a.hasTimeIn).length;
  const timedOutCount = attendance.filter((a) => a.hasTimeOut).length;

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Today&apos;s Attendance — {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </h2>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold text-foreground">{attendance.length}</p>
            <p className="text-sm text-muted-foreground">Total Trainees</p>
          </div>
          <div className="p-4 bg-success/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-success">{timedInCount}</p>
            <p className="text-sm text-muted-foreground">Timed In</p>
          </div>
          <div className="p-4 bg-primary-light dark:bg-primary/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-primary dark:text-primary">{timedOutCount}</p>
            <p className="text-sm text-muted-foreground">Timed Out</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : attendance.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No trainees found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Trainee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Time In</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Time Out</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attendance.map((a) => (
                  <tr key={a.traineeId} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{a.traineeName}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {a.timeInTime ? formatTime12(a.timeInTime) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {a.timeOutTime ? formatTime12(a.timeOutTime) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        a.hasTimeOut
                          ? 'bg-primary-light text-primary dark:bg-primary/20 dark:text-primary'
                          : a.hasTimeIn
                            ? 'bg-success/15 text-success'
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        {a.hasTimeOut ? 'Timed Out' : a.hasTimeIn ? 'Timed In' : 'Absent'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
