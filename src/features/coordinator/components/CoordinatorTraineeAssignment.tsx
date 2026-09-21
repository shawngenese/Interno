import { useState, useEffect, useCallback, useRef } from 'react';
import { getCoordinatorTrainees, getSupervisors, updateTraineeAssignment } from '../services/coordinatorService';
import { useAuth } from '@/features/auth';
import type { CoordinatorTrainee } from '../types';

interface Supervisor {
  id: string;
  name: string;
  email: string;
  companyId?: string;
  assignedTrainees?: string[];
}

export function CoordinatorTraineeAssignment() {
  const { user } = useAuth();
  const [trainees, setTrainees] = useState<CoordinatorTrainee[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedTrainee, setDraggedTrainee] = useState<CoordinatorTrainee | null>(null);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragOverSupervisor, setDragOverSupervisor] = useState<string | null>(null);
  const [dragOverUnassigned, setDragOverUnassigned] = useState(false);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const tokenResult = await user.getIdTokenResult();
      const cid = (tokenResult.claims.companyId as string) || '';

      const [traineeData, supervisorData] = await Promise.all([
        getCoordinatorTrainees(user.uid, cid),
        getSupervisors(),
      ]);

      if (!signal?.aborted) {
        setTrainees(traineeData);
        setSupervisors(supervisorData.filter(s => s.companyId === cid));
      }
    } catch (err) {
      if (!signal?.aborted) {
        console.error('Failed to load data:', err);
        setError('Failed to load data');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const handleDragStart = (trainee: CoordinatorTrainee) => {
    setDraggedTrainee(trainee);
    setDragSource(trainee.supervisorId || 'unassigned');
  };

  const handleDragOver = (e: React.DragEvent, supervisorId: string) => {
    e.preventDefault();
    setDragOverSupervisor(supervisorId);
  };

  const handleDragLeave = () => {
    setDragOverSupervisor(null);
    setDragOverUnassigned(false);
  };

  const handleDragEnd = () => {
    setDraggedTrainee(null);
    setDragSource(null);
    setDragOverSupervisor(null);
    setDragOverUnassigned(false);
  };

  const handleDrop = async (e: React.DragEvent, supervisorId: string) => {
    e.preventDefault();
    setDragOverSupervisor(null);
    setDragOverUnassigned(false);

    const target = supervisorId || 'unassigned';
    if (!draggedTrainee || dragSource === target) {
      setDraggedTrainee(null);
      setDragSource(null);
      return;
    }

    const traineeId = draggedTrainee.traineeId;
    setDraggedTrainee(null);
    setDragSource(null);

    setTrainees(prev => prev.map(t =>
      t.traineeId === traineeId ? { ...t, supervisorId: supervisorId || undefined } : t
    ));

    setSaving(true);
    try {
      await updateTraineeAssignment(traineeId, { supervisorId });
    } catch (err) {
      setError('Failed to update assignment');
      console.error(err);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (trainee: CoordinatorTrainee) => {
    setTrainees(prev => prev.map(t =>
      t.traineeId === trainee.traineeId ? { ...t, supervisorId: undefined } : t
    ));

    setSaving(true);
    try {
      await updateTraineeAssignment(trainee.traineeId, { supervisorId: '' });
    } catch (err) {
      setError('Failed to remove assignment');
      console.error(err);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const getTraineesForSupervisor = (supervisorId: string) => {
    return trainees.filter(t => t.supervisorId === supervisorId);
  };

  const getUnassignedTrainees = () => {
    return trainees.filter(t => !t.supervisorId);
  };

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#121212] dark:text-white">Assign Trainees to Supervisors</h2>
        {saving && (
          <span className="text-sm text-[#757575] dark:text-[#9E9E9E]">Saving...</span>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Unassigned Trainees */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOverUnassigned(true); }}
          onDragLeave={() => setDragOverUnassigned(false)}
          onDrop={(e) => { handleDrop(e, ''); setDragOverUnassigned(false); }}
          className={`bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border transition-colors ${
            dragOverUnassigned
              ? 'border-2 border-dashed border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border border-[#D5D5D5] dark:border-[#3A3A3A]'
          }`}
        >
          <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
            <h3 className="font-semibold text-[#121212] dark:text-white">
              Unassigned Trainees ({getUnassignedTrainees().length})
            </h3>
          </div>
          <div className="p-4 space-y-2 min-h-[200px]">
            {getUnassignedTrainees().length === 0 ? (
              <p className="text-sm text-[#757575] dark:text-[#9E9E9E] text-center py-4">
                All trainees are assigned
              </p>
            ) : (
              getUnassignedTrainees().map((trainee) => (
                <div
                  key={trainee.traineeId}
                  draggable
                  onDragStart={() => handleDragStart(trainee)}
                  onDragEnd={handleDragEnd}
                  className="p-3 bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 rounded-lg border border-[#D5D5D5] dark:border-[#555555] cursor-move hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                  <div className="font-medium text-[#121212] dark:text-white text-sm">{trainee.name}</div>
                  <div className="text-xs text-[#757575] dark:text-[#9E9E9E]">{trainee.email}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Supervisors */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
          <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
            <h3 className="font-semibold text-[#121212] dark:text-white">Supervisors</h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {supervisors.length === 0 ? (
              <p className="text-sm text-[#757575] dark:text-[#9E9E9E] text-center py-4 col-span-2">
                No supervisors found
              </p>
            ) : (
              supervisors.map((supervisor) => {
                const assignedTrainees = getTraineesForSupervisor(supervisor.id);
                const isDragOver = dragOverSupervisor === supervisor.id;

                return (
                  <div
                    key={supervisor.id}
                    onDragOver={(e) => handleDragOver(e, supervisor.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, supervisor.id)}
                    className={`p-4 rounded-xl border transition-colors ${
                      isDragOver
                        ? 'border-2 border-dashed border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border border-[#D5D5D5] dark:border-[#3A3A3A] bg-[#F5F5F5] dark:bg-[#3A3A3A]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-[#121212] dark:text-white">{supervisor.name}</h4>
                        <p className="text-xs text-[#757575] dark:text-[#9E9E9E]">{supervisor.email}</p>
                      </div>
                      <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium text-[#757575] dark:text-[#9E9E9E] bg-[#EFEFEF] dark:bg-[#555555] rounded-full">
                        {assignedTrainees.length}
                      </span>
                    </div>

                    <div className="space-y-2 min-h-[60px]">
                      {assignedTrainees.length === 0 ? (
                        <p className="text-xs text-[#9E9E9E] dark:text-[#757575] text-center py-2">
                          Drop trainees here
                        </p>
                      ) : (
                        assignedTrainees.map((trainee) => (
                          <div
                            key={trainee.traineeId}
                            draggable
                            onDragStart={() => handleDragStart(trainee)}
                            onDragEnd={handleDragEnd}
                            className="flex items-center justify-between p-3 bg-white dark:bg-[#1E1E1E] rounded-lg border border-[#D5D5D5] dark:border-[#555555] cursor-move hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-[#121212] dark:text-white truncate">{trainee.name}</div>
                              <div className="text-xs text-[#757575] dark:text-[#9E9E9E] truncate">{trainee.email}</div>
                            </div>
                            <button
                              onClick={() => handleRemoveAssignment(trainee)}
                              className="ml-2 shrink-0 p-1 text-[#757575] hover:text-red-600 dark:text-[#9E9E9E] dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Remove assignment"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
