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
          query(collection(db, 'users'), where(documentId(), 'in', batch)),
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
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <h2 className="text-lg font-semibold text-[#121212] dark:text-white mb-4">
          Today&apos;s Attendance — {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </h2>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 rounded-lg text-center">
            <p className="text-2xl font-bold text-[#121212] dark:text-white">{attendance.length}</p>
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Total Trainees</p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{timedInCount}</p>
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Timed In</p>
          </div>
          <div className="p-4 bg-primary-light dark:bg-primary/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-primary dark:text-primary">{timedOutCount}</p>
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Timed Out</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[#EFEFEF] dark:bg-[#3A3A3A] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : attendance.length === 0 ? (
          <p className="text-center text-[#757575] dark:text-[#9E9E9E] py-8">No trainees found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F5F5F5] dark:bg-[#3A3A3A]/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Trainee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Time In</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Time Out</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5D5D5] dark:divide-[#3A3A3A]">
                {attendance.map((a) => (
                  <tr key={a.traineeId} className="hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/50">
                    <td className="px-4 py-3 text-sm font-medium text-[#121212] dark:text-white">{a.traineeName}</td>
                    <td className="px-4 py-3 text-sm text-[#757575] dark:text-[#9E9E9E]">
                      {a.timeInTime ? formatTime12(a.timeInTime) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#757575] dark:text-[#9E9E9E]">
                      {a.timeOutTime ? formatTime12(a.timeOutTime) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        a.hasTimeOut
                          ? 'bg-primary-light text-primary dark:bg-primary/20 dark:text-primary'
                          : a.hasTimeIn
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-[#EFEFEF] text-[#555555] dark:bg-[#3A3A3A] dark:text-[#9E9E9E]'
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
