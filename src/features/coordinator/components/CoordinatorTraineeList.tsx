import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCoordinatorTrainees, updateTraineeAssignment, getSupervisors } from '../services/coordinatorService';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { CoordinatorTrainee } from '../types';

interface Supervisor {
  id: string;
  name: string;
  email: string;
  companyId?: string;
}

export function CoordinatorTraineeList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trainees, setTrainees] = useState<CoordinatorTrainee[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrainee, setSelectedTrainee] = useState<CoordinatorTrainee | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const db = getFirestoreInstancePublic();
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (!userSnap.exists()) return;
      const userData = userSnap.data() as { companyId?: string };
      const cid = userData.companyId || '';

      const [traineeData, supervisorData] = await Promise.all([
        getCoordinatorTrainees(user.uid, cid),
        getSupervisors(),
      ]);

      setTrainees(traineeData);
      setSupervisors(supervisorData.filter(s => s.companyId === cid));
    } catch (err) {
      console.error('Failed to load trainees:', err);
      setError('Failed to load trainees');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (trainee: CoordinatorTrainee) => {
    setSelectedTrainee(trainee);
    setSelectedSupervisorId(trainee.supervisorId || '');
    setAssigning(true);
  };

  const handleSaveAssignment = async () => {
    if (!selectedTrainee) return;
    try {
      await updateTraineeAssignment(selectedTrainee.traineeId, {
        supervisorId: selectedSupervisorId || undefined,
      });
      setAssigning(false);
      setSelectedTrainee(null);
      fetchData();
    } catch (err) {
      setError('Failed to update assignment');
      console.error(err);
    }
  };

  const filteredTrainees = trainees.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    return true;
  });

  const getSupervisorName = (supervisorId?: string) => {
    if (!supervisorId) return 'Unassigned';
    return supervisors.find(s => s.id === supervisorId)?.name || 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#121212] dark:text-white">Manage Trainees</h2>
        <button
          onClick={() => navigate('/coordinator')}
          className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
        <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
          <div className="flex items-center gap-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F5F5] dark:bg-[#3A3A3A]/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Trainee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Supervisor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">OJT Progress</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5D5D5] dark:divide-[#3A3A3A]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#757575] dark:text-[#9E9E9E]">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading trainees...
                    </div>
                  </td>
                </tr>
              ) : filteredTrainees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#757575] dark:text-[#9E9E9E]">
                    No trainees found
                  </td>
                </tr>
              ) : (
                filteredTrainees.map((trainee) => (
                  <tr key={trainee.traineeId} className="hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/50">
                    <td className="px-4 py-4">
                      <div className="font-medium text-[#121212] dark:text-white">{trainee.name}</div>
                      <div className="text-sm text-[#757575] dark:text-[#9E9E9E]">{trainee.email}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        trainee.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : trainee.status === 'completed'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-[#EFEFEF] text-[#1E1E1E] dark:bg-[#3A3A3A] dark:text-[#9E9E9E]'
                      }`}>
                        {trainee.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                      {getSupervisorName(trainee.supervisorId)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-[#121212] dark:text-white">
                        {trainee.ojtHoursCompleted}/{trainee.ojtHoursRequired}h
                      </div>
                      <div className="w-full bg-[#D5D5D5] dark:bg-[#3A3A3A] rounded-full h-1.5 mt-1">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, (trainee.ojtHoursCompleted / trainee.ojtHoursRequired) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleAssign(trainee)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        Assign
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {assigning && selectedTrainee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-xl max-w-md w-full">
            <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
              <h4 className="text-lg font-semibold text-[#121212] dark:text-white">
                Assign Supervisor
              </h4>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Trainee</p>
                <p className="font-medium text-[#121212] dark:text-white">{selectedTrainee.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
                  Select Supervisor
                </label>
                <select
                  value={selectedSupervisorId}
                  onChange={(e) => setSelectedSupervisorId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No Supervisor</option>
                  {supervisors.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} ({sup.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A] flex justify-end gap-3">
              <button
                onClick={() => {
                  setAssigning(false);
                  setSelectedTrainee(null);
                }}
                className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAssignment}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
