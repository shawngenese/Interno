import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { Supervisor, Trainee } from '../types';

interface SupervisorTraineeAssignmentProps {
  supervisor: Supervisor;
  onClose: () => void;
  onSuccess: () => void;
}

export function SupervisorTraineeAssignment({ supervisor, onClose, onSuccess }: SupervisorTraineeAssignmentProps) {
  const [allTrainees, setAllTrainees] = useState<(Trainee & { userName?: string })[]>([]);
  const [assignedTraineeIds, setAssignedTraineeIds] = useState<string[]>(supervisor.assignedTrainees || []);
  const [originalAssignedIds, setOriginalAssignedIds] = useState<string[]>(supervisor.assignedTrainees || []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [otherSupervisorNames, setOtherSupervisorNames] = useState<Record<string, string>>({});

  const fetchTrainees = useCallback(async () => {
    setLoading(true);
    try {
      const db = getFirestoreInstancePublic();
      const [traineeResult, resolvedName] = await Promise.all([
        adminService.listTrainees({ 
          limit: 500,
          companyId: supervisor.companyId,
        }),
        resolveDocName('users', supervisor.userId, 'displayName').catch(() => supervisor.userId),
      ]);
      setSupervisorName(resolvedName);

      // Resolve other supervisor names for trainees assigned to a different supervisor
      const otherSupNames: Record<string, string> = {};
      await Promise.all(
        traineeResult.data
          .filter(t => t.supervisorId && t.supervisorId !== supervisor.id)
          .map(async (t) => {
            if (otherSupNames[t.supervisorId!]) return;
            try {
              const supDoc = await getDoc(doc(db, 'supervisors', t.supervisorId!));
              if (supDoc.exists()) {
                const supUserId = (supDoc.data() as Record<string, unknown>).userId as string;
                if (supUserId) {
                  const name = await resolveDocName('users', supUserId, 'displayName');
                  otherSupNames[t.supervisorId!] = name || 'Unknown';
                }
              }
            } catch {
              otherSupNames[t.supervisorId!] = 'Unknown';
            }
          }),
      );
      setOtherSupervisorNames(otherSupNames);

      const resolved = await Promise.all(
        traineeResult.data.map(async (t) => {
          const userName = await resolveDocName('users', t.userId, 'displayName');
          return { ...t, userName };
        }),
      );
      setAllTrainees(resolved);
      setAssignedTraineeIds(supervisor.assignedTrainees || []);
      setOriginalAssignedIds(supervisor.assignedTrainees || []);
    } catch (err) {
      setError('Failed to load trainees');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supervisor.companyId, supervisor.id, supervisor.assignedTrainees, supervisor.userId]);

  useEffect(() => {
    fetchTrainees();
  }, [fetchTrainees]);

  const filteredTrainees = allTrainees.filter(trainee => 
    trainee.profile?.studentId?.toLowerCase().includes(search.toLowerCase()) ||
    trainee.userName?.toLowerCase().includes(search.toLowerCase()) ||
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
      const unassignTraineeIds = originalAssignedIds.filter(id => !assignedTraineeIds.includes(id));
      await adminService.assignTraineesToSupervisor(supervisor.id, assignedTraineeIds, unassignTraineeIds);
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign trainees';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify([...assignedTraineeIds].sort()) !== JSON.stringify([...originalAssignedIds].sort());

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-8">
        <div className="flex items-center justify-center h-32">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
      <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#121212] dark:text-white">
              Assign Trainees to {supervisorName || '...'}
            </h2>
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E] mt-1">
              {assignedTraineeIds.length} of {allTrainees.length} trainees assigned
              {hasChanges && <span className="ml-2 text-yellow-600 dark:text-yellow-400">(unsaved changes)</span>}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search trainees by name, student ID, or course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search trainees"
              className="w-full px-4 py-2 pl-10 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            onClick={handleSelectAll}
            className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#555555] transition-colors"
          >
            {assignedTraineeIds.length === filteredTrainees.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      <div className="p-4">
        {filteredTrainees.length === 0 ? (
          <div className="text-center py-8 text-[#757575] dark:text-[#9E9E9E]">
            No trainees found
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTrainees.map(trainee => {
              const isAssigned = assignedTraineeIds.includes(trainee.id);
              const wasAssigned = originalAssignedIds.includes(trainee.id);
              const isNewlyAssigned = isAssigned && !wasAssigned;
              const isRemoved = !isAssigned && wasAssigned;
              const hasOtherSupervisor = !!trainee.supervisorId && trainee.supervisorId !== supervisor.id;
              const otherSupName = hasOtherSupervisor ? otherSupervisorNames[trainee.supervisorId!] : null;
              return (
                <div
                  key={trainee.id}
                  className={`flex items-center p-3 rounded-lg border transition-colors ${
                    hasOtherSupervisor
                      ? 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/50 opacity-70 cursor-not-allowed'
                      : isRemoved
                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50 opacity-60 cursor-pointer'
                        : isAssigned
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 cursor-pointer'
                          : 'bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 border-[#D5D5D5] dark:border-[#555555] hover:bg-[#EFEFEF] dark:hover:bg-[#3A3A3A] cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isAssigned}
                    disabled={hasOtherSupervisor}
                    onChange={() => handleToggleTrainee(trainee.id)}
                    className="w-4 h-4 text-blue-600 border-[#BDBDBD] rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${hasOtherSupervisor ? 'text-[#757575] dark:text-[#9E9E9E]' : 'text-[#121212] dark:text-white'}`}>
                        {trainee.userName || '—'}
                      </p>
                      {hasOtherSupervisor && (
                        <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 rounded-full flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Assigned to {otherSupName || 'another supervisor'}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${hasOtherSupervisor ? 'text-[#9E9E9E] dark:text-[#757575]' : 'text-[#757575] dark:text-[#9E9E9E]'}`}>
                      {trainee.profile?.studentId && `${trainee.profile.studentId} • `}
                      {trainee.profile?.course}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isNewlyAssigned && (
                      <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-full font-medium">
                        New
                      </span>
                    )}
                    {wasAssigned && !isNewlyAssigned && (
                      <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full">
                        Assigned
                      </span>
                    )}
                    {isRemoved && (
                      <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 rounded-full">
                        Removing
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A] flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#555555] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Assignments'}
        </button>
      </div>
    </div>
  );
}
