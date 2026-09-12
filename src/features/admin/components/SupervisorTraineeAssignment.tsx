import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/adminService';
import type { Supervisor, Trainee } from '../types';

interface SupervisorTraineeAssignmentProps {
  supervisor: Supervisor;
  onClose: () => void;
  onSuccess: () => void;
}

export function SupervisorTraineeAssignment({ supervisor, onClose, onSuccess }: SupervisorTraineeAssignmentProps) {
  const [allTrainees, setAllTrainees] = useState<Trainee[]>([]);
  const [assignedTraineeIds, setAssignedTraineeIds] = useState<string[]>(supervisor.assignedTrainees || []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchTrainees = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminService.listTrainees({ 
        limit: 500,
        companyId: supervisor.companyId,
        departmentId: supervisor.departmentId
      });
      setAllTrainees(result.data);
      setAssignedTraineeIds(supervisor.assignedTrainees || []);
    } catch (err) {
      setError('Failed to load trainees');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supervisor.companyId, supervisor.departmentId, supervisor.assignedTrainees]);

  useEffect(() => {
    fetchTrainees();
  }, [fetchTrainees]);

  const filteredTrainees = allTrainees.filter(trainee => 
    trainee.profile?.studentId?.toLowerCase().includes(search.toLowerCase()) ||
    trainee.userId.toLowerCase().includes(search.toLowerCase()) ||
    trainee.profile?.course?.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleTrainee = (traineeId: string) => {
    setAssignedTraineeIds(prev => 
      prev.includes(traineeId)
        ? prev.filter(id => id !== traineeId)
        : [...prev, traineeId]
    );
  };

  const handleSelectAll = () => {
    if (assignedTraineeIds.length === filteredTrainees.length) {
      setAssignedTraineeIds(prev => prev.filter(id => !filteredTrainees.map(t => t.id).includes(id)));
    } else {
      setAssignedTraineeIds(prev => {
        const newIds = filteredTrainees.map(t => t.id).filter(id => !prev.includes(id));
        return [...prev, ...newIds];
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminService.assignTraineesToSupervisor(supervisor.id, assignedTraineeIds);
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign trainees';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center h-32">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Assign Trainees to {supervisor.userId}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search trainees by name, student ID, or course..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              {assignedTraineeIds.length === filteredTrainees.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[50vh] p-4">
          {filteredTrainees.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No trainees found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTrainees.map(trainee => {
                const isAssigned = assignedTraineeIds.includes(trainee.id);
                return (
                  <label
                    key={trainee.id}
                    className={`flex items-center p-3 rounded-lg border transition-colors cursor-pointer ${
                      isAssigned
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      onChange={() => handleToggleTrainee(trainee.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <div className="ml-3 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {trainee.profile?.studentId || trainee.userId}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {trainee.profile?.course} • {trainee.profile?.school}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {trainee.profile?.yearLevel} • Status: {trainee.ojtStatus}
                      </p>
                    </div>
                    {isAssigned && (
                      <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full">
                        Assigned
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Assignments'}
          </button>
        </div>
      </div>
    </div>
  );
}