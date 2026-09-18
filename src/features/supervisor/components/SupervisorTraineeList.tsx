import { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth';
import { getSupervisorByUserId, getAssignedTrainees, getTraineeAttendanceSummary } from '../services/supervisorService';
import type { Trainee } from '@/features/admin/types';

export function SupervisorTraineeList() {
  const { user } = useAuth();
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<Record<string, { hasTimeIn: boolean; hasTimeOut: boolean }>>({});

  useEffect(() => {
    if (!user?.uid) return;

    const loadTrainees = async () => {
      setLoading(true);
      setError(null);
      try {
        const sup = await getSupervisorByUserId(user.uid);
        if (sup) {
          const assigned = await getAssignedTrainees(sup.id);
          setTrainees(assigned);
          const att = assigned.length > 0
            ? await getTraineeAttendanceSummary(assigned.map(t => t.id)).catch(() => ({}))
            : {};
          setAttendance(att);
        }
      } catch (err) {
        console.error('Failed to load trainees:', err);
        setError('Failed to load trainees');
      } finally {
        setLoading(false);
      }
    };

    loadTrainees();
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
      <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        <h2 className="text-lg font-semibold text-[#121212] dark:text-white">Assigned Trainees</h2>
        <p className="text-sm text-[#757575] dark:text-[#9E9E9E] mt-1">{trainees.length} trainee(s) assigned to you</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#F5F5F5] dark:bg-[#3A3A3A]/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Student ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Course</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">School</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">OJT Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Today</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D5D5D5] dark:divide-[#3A3A3A]">
            {trainees.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#757575] dark:text-[#9E9E9E]">
                  No trainees assigned
                </td>
              </tr>
            ) : (
              trainees.map(trainee => {
                const att = attendance[trainee.id];
                return (
                  <tr key={trainee.id} className="hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/50">
                    <td className="px-4 py-4 text-sm font-medium text-[#121212] dark:text-white">
                      {trainee.name || trainee.profile?.studentId || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                      {trainee.profile?.course || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                      {trainee.profile?.school || '-'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        trainee.ojtStatus === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : trainee.ojtStatus === 'on_leave'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-[#EFEFEF] text-[#555555] dark:bg-[#3A3A3A] dark:text-[#9E9E9E]'
                      }`}>
                        {trainee.ojtStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${att?.hasTimeIn ? 'bg-green-500' : 'bg-[#BDBDBD] dark:bg-[#555555]'}`} />
                        <span className="text-xs text-[#757575] dark:text-[#9E9E9E]">
                          {att?.hasTimeIn ? (att?.hasTimeOut ? 'Completed' : 'In progress') : 'Not started'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
