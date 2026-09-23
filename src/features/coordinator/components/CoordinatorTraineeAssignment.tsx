import { useState, useEffect, useCallback, useRef } from 'react';
import { getCoordinatorTrainees, getSupervisors, updateTraineeAssignment } from '../services/coordinatorService';
import { useAuth } from '@/features/auth';
import type { CoordinatorTrainee } from '../types';
import { Skeleton } from '@/shared/components/Skeleton';
import { Users, UserCheck, X, GripVertical } from 'lucide-react';

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
        getSupervisors(cid),
      ]);

      if (!signal?.aborted) {
        setTrainees(traineeData);
        setSupervisors(supervisorData.filter((s) => s.companyId === cid));
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

    setTrainees((prev) =>
      prev.map((t) =>
        t.traineeId === traineeId ? { ...t, supervisorId: supervisorId || undefined } : t,
      ),
    );

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
    setTrainees((prev) =>
      prev.map((t) =>
        t.traineeId === trainee.traineeId ? { ...t, supervisorId: undefined } : t,
      ),
    );

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
    return trainees.filter((t) => t.supervisorId === supervisorId);
  };

  const getUnassignedTrainees = () => {
    return trainees.filter((t) => !t.supervisorId);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="text" width="40%" height={28} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton variant="rectangular" height={300} className="rounded-xl" />
          <Skeleton variant="rectangular" height={300} className="lg:col-span-2 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Assign Trainees to Supervisors</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drag and drop trainees between panels to quickly assign or reassign supervisors
          </p>
        </div>
        {saving && <span className="text-xs text-muted-foreground animate-pulse font-medium">Saving...</span>}
      </div>

      {error && (
        <div role="alert" className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Unassigned Trainees */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverUnassigned(true);
          }}
          onDragLeave={() => setDragOverUnassigned(false)}
          onDrop={(e) => {
            handleDrop(e, '');
            setDragOverUnassigned(false);
          }}
          className={`bg-card rounded-xl shadow-sm border transition-colors ${
            dragOverUnassigned
              ? 'border-2 border-dashed border-primary bg-primary/5'
              : 'border-border'
          }`}
        >
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-warning" />
              <h3 className="font-semibold text-foreground text-sm">
                Unassigned Trainees
              </h3>
            </div>
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-warning/15 text-warning">
              {getUnassignedTrainees().length}
            </span>
          </div>

          <div className="p-4 space-y-2 min-h-[220px]">
            {getUnassignedTrainees().length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                All trainees are currently assigned
              </p>
            ) : (
              getUnassignedTrainees().map((trainee) => (
                <div
                  key={trainee.traineeId}
                  draggable
                  onDragStart={() => handleDragStart(trainee)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg border border-border cursor-grab active:cursor-grabbing hover:border-primary transition-colors"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground text-sm truncate">{trainee.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{trainee.email}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Supervisors */}
        <div className="lg:col-span-2 bg-card rounded-xl shadow-sm border border-border">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">Supervisors ({supervisors.length})</h3>
            </div>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {supervisors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 col-span-2">
                No departmental supervisors found.
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
                        ? 'border-2 border-dashed border-primary bg-primary/5'
                        : 'border-border bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-foreground text-sm">{supervisor.name}</h4>
                        <p className="text-xs text-muted-foreground">{supervisor.email}</p>
                      </div>
                      <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/15 text-primary">
                        {assignedTrainees.length} trainees
                      </span>
                    </div>

                    <div className="space-y-2 min-h-[70px]">
                      {assignedTrainees.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                          Drop trainees here to assign
                        </p>
                      ) : (
                        assignedTrainees.map((trainee) => (
                          <div
                            key={trainee.traineeId}
                            draggable
                            onDragStart={() => handleDragStart(trainee)}
                            onDragEnd={handleDragEnd}
                            className="flex items-center justify-between p-2.5 bg-card rounded-lg border border-border cursor-grab active:cursor-grabbing hover:border-primary transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-foreground truncate">{trainee.name}</div>
                                <div className="text-[11px] text-muted-foreground truncate">{trainee.email}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAssignment(trainee)}
                              className="ml-2 shrink-0 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                              title="Unassign trainee"
                            >
                              <X className="w-3.5 h-3.5" />
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
