import { useState, useEffect, useCallback } from 'react';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs, doc, getDoc, documentId } from 'firebase/firestore';
import { useAuth } from '@/features/auth';

interface TraineeTaskSummary {
  traineeId: string;
  traineeName: string;
  total: number;
  pending: number;
  inProgress: number;
  submitted: number;
  approved: number;
  returned: number;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function CoordinatorTaskView() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<TraineeTaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const db = getFirestoreInstancePublic();

      // Resolve coordinator's companyId
      const coordSnap = await getDoc(doc(db, 'coordinators', user.uid));
      if (!coordSnap.exists()) {
        if (!signal?.aborted) { setSummaries([]); setLoading(false); }
        return;
      }
      const companyId = coordSnap.data().companyId as string;
      if (!companyId) {
        if (!signal?.aborted) { setSummaries([]); setLoading(false); }
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
        if (!signal?.aborted) { setSummaries([]); setLoading(false); }
        return;
      }

      // Get tasks for all trainees
      const result: TraineeTaskSummary[] = traineeIds.map((id) => ({
        traineeId: id,
        traineeName: traineeMap.get(id) || 'Unknown',
        total: 0,
        pending: 0,
        inProgress: 0,
        submitted: 0,
        approved: 0,
        returned: 0,
      }));

      for (let i = 0; i < traineeIds.length; i += 30) {
        const batch = traineeIds.slice(i, i + 30);
        const taskSnap = await getDocs(
          query(collection(db, 'tasks'), where('traineeId', 'in', batch)),
        );
        if (signal?.aborted) return;

        for (const doc of taskSnap.docs) {
          const data = doc.data();
          const tid = data.traineeId as string;
          const entry = result.find((r) => r.traineeId === tid);
          if (entry) {
            entry.total++;
            switch (data.status) {
              case 'pending': entry.pending++; break;
              case 'in_progress': entry.inProgress++; break;
              case 'submitted': entry.submitted++; break;
              case 'approved': entry.approved++; break;
              case 'returned': entry.returned++; break;
            }
          }
        }
      }

      if (!signal?.aborted) setSummaries(result);
    } catch (err) {
      if (!signal?.aborted) {
        console.error('Failed to load task summaries:', err);
        setError('Failed to load task data');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const totalTasks = summaries.reduce((sum, s) => sum + s.total, 0);
  const totalPending = summaries.reduce((sum, s) => sum + s.pending + s.inProgress, 0);
  const totalSubmitted = summaries.reduce((sum, s) => sum + s.submitted, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <h2 className="text-lg font-semibold text-[#121212] dark:text-white mb-4">Task Overview</h2>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 rounded-lg text-center">
            <p className="text-2xl font-bold text-[#121212] dark:text-white">{totalTasks}</p>
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Total Tasks</p>
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{totalPending}</p>
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">In Progress</p>
          </div>
          <div className="p-4 bg-primary-light dark:bg-primary/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-primary dark:text-primary">{totalSubmitted}</p>
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Awaiting Review</p>
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
        ) : summaries.length === 0 ? (
          <p className="text-center text-[#757575] dark:text-[#9E9E9E] py-8">No trainees found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F5F5F5] dark:bg-[#3A3A3A]/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Trainee</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Pending</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">In Progress</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Submitted</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Approved</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Returned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5D5D5] dark:divide-[#3A3A3A]">
                {summaries.map((s) => (
                  <tr key={s.traineeId} className="hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/50">
                    <td className="px-4 py-3 text-sm font-medium text-[#121212] dark:text-white">{s.traineeName}</td>
                    <td className="px-4 py-3 text-sm text-center text-[#121212] dark:text-white">{s.total}</td>
                    <td className="px-4 py-3 text-sm text-center text-yellow-600 dark:text-yellow-400">{s.pending}</td>
                    <td className="px-4 py-3 text-sm text-center text-orange-600 dark:text-orange-400">{s.inProgress}</td>
                    <td className="px-4 py-3 text-sm text-center text-primary dark:text-primary">{s.submitted}</td>
                    <td className="px-4 py-3 text-sm text-center text-green-600 dark:text-green-400">{s.approved}</td>
                    <td className="px-4 py-3 text-sm text-center text-red-600 dark:text-red-400">{s.returned}</td>
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
