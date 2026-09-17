import { useState, useEffect } from 'react';
import { getCoordinatorTrainees, getSupervisors, updateTraineeAssignment } from '../services/coordinatorService';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
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
  const [dragOverSupervisor, setDragOverSupervisor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      console.error('Failed to load data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (trainee: CoordinatorTrainee) => {
    setDraggedTrainee(trainee);
  };

  const handleDragOver = (e: React.DragEvent, supervisorId: string) => {
    e.preventDefault();
    setDragOverSupervisor(supervisorId);
  };

  const handleDragLeave = () => {
    setDragOverSupervisor(null);
  };

  const handleDrop = async (e: React.DragEvent, supervisorId: string) => {
    e.preventDefault();
    setDragOverSupervisor(null);

    if (!draggedTrainee) return;

    setSaving(true);
    try {
      await updateTraineeAssignment(draggedTrainee.traineeId, {
        supervisorId: supervisorId || undefined,
      });
      setDraggedTrainee(null);
      fetchData();
    } catch (err) {
      setError('Failed to update assignment');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (trainee: CoordinatorTrainee) => {
    setSaving(true);
    try {
      await updateTraineeAssignment(trainee.traineeId, {
        supervisorId: undefined,
      });
      fetchData();
    } catch (err) {
      setError('Failed to remove assignment');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getTraineesForSupervisor = (supervisorId: string) => {
    return trainees.filter(t => t.supervisorId === supervisorId);
  };

  const getUnassignedTrainees = () => {
    return trainees.filter(t => !t.supervisorId && t.status === 'active');
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Assign Trainees to Supervisors</h2>
        {saving && (
          <span className="text-sm text-gray-500 dark:text-gray-400">Saving...</span>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Unassigned Trainees */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Unassigned Trainees ({getUnassignedTrainees().length})
            </h3>
          </div>
          <div className="p-4 space-y-2 min-h-[200px]">
            {getUnassignedTrainees().length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                All trainees are assigned
              </p>
            ) : (
              getUnassignedTrainees().map((trainee) => (
                <div
                  key={trainee.traineeId}
                  draggable
                  onDragStart={() => handleDragStart(trainee)}
                  className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 cursor-move hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                  <div className="font-medium text-gray-900 dark:text-white text-sm">{trainee.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{trainee.email}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Supervisors */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Supervisors</h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {supervisors.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 col-span-2">
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
                    className={`p-4 rounded-lg border-2 border-dashed transition-colors ${
                      isDragOver
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">{supervisor.name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{supervisor.email}</p>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {assignedTrainees.length} trainee(s)
                      </span>
                    </div>

                    <div className="space-y-2 min-h-[60px]">
                      {assignedTrainees.length === 0 ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
                          Drop trainees here
                        </p>
                      ) : (
                        assignedTrainees.map((trainee) => (
                          <div
                            key={trainee.traineeId}
                            className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600"
                          >
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{trainee.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{trainee.email}</div>
                            </div>
                            <button
                              onClick={() => handleRemoveAssignment(trainee)}
                              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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
