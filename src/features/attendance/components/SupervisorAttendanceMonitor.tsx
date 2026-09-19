import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSupervisor } from '@/shared/hooks/useSupervisor';
import { getAssignedTrainees } from '@/features/supervisor/services/supervisorService';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs } from 'firebase/firestore';
import { formatTime12 } from '@/shared/utils/dateUtils';

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
        const trainees = await getAssignedTrainees(supervisor.id, supervisor.companyId);
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
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <h2 className="text-lg font-semibold text-[#121212] dark:text-white mb-4">Attendance Monitor</h2>
        <p className="text-sm text-[#757575] dark:text-[#9E9E9E] mb-6">Real-time attendance status of assigned trainees.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Assigned</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{statuses.length}</p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">Timed In</p>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">{allTimedIn.length}</p>
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Missing Time Out</p>
            <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{missingTimeOut.length}</p>
          </div>
        </div>

        {missingTimeOut.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {missingTimeOut.length} trainee(s) have not timed out yet
              </p>
            </div>
            <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300">
              {missingTimeOut.map((s) => (
                <li key={s.traineeId}>{s.traineeName} (timed in at {s.timeInTime})</li>
              ))}
            </ul>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-red-500 dark:text-red-400">{error}</p>
            <button
              onClick={() => { setError(null); setRetryKey(k => k + 1); }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : statuses.length === 0 ? (
          <p className="text-center text-[#757575] dark:text-[#9E9E9E] py-8">No assigned trainees found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
                  <th className="text-left py-3 px-4 font-medium text-[#3A3A3A] dark:text-[#BDBDBD]">Trainee</th>
                  <th className="text-center py-3 px-4 font-medium text-[#3A3A3A] dark:text-[#BDBDBD]">Status</th>
                  <th className="text-center py-3 px-4 font-medium text-[#3A3A3A] dark:text-[#BDBDBD]">Time In</th>
                  <th className="text-center py-3 px-4 font-medium text-[#3A3A3A] dark:text-[#BDBDBD]">Time Out</th>
                </tr>
              </thead>
              <tbody>
                {statuses.map((status) => (
                  <tr key={status.traineeId} className="border-b border-gray-100 dark:border-[#3A3A3A]/50 hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[#D5D5D5] dark:bg-[#555555] flex items-center justify-center text-xs font-medium text-[#555555] dark:text-[#BDBDBD]">
                          {status.traineeName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="font-medium text-[#121212] dark:text-white">{status.traineeName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {status.hasTimeIn && status.hasTimeOut ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                          Complete
                        </span>
                      ) : status.hasTimeIn ? (
                        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full">
                          Timed In
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-[#EFEFEF] dark:bg-[#3A3A3A] text-[#757575] dark:text-[#9E9E9E] rounded-full">
                          Not Started
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-[#555555] dark:text-[#9E9E9E]">
                      {status.timeInTime || '—'}
                    </td>
                    <td className="py-3 px-4 text-center text-[#555555] dark:text-[#9E9E9E]">
                      {status.timeOutTime || '—'}
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
