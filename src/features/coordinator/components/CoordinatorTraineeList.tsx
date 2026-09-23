import { useState, useEffect, useCallback, useRef } from 'react';
import { getCoordinatorTrainees, updateTraineeAssignment, getSupervisors } from '../services/coordinatorService';
import { useAuth } from '@/features/auth';
import type { CoordinatorTrainee } from '../types';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { FormField, FormSelect } from '@/shared/components/FormField';
import { UserCheck, Clock } from 'lucide-react';

interface Supervisor {
  id: string;
  name: string;
  email: string;
  companyId?: string;
}

export function CoordinatorTraineeList() {
  const { user } = useAuth();
  const [trainees, setTrainees] = useState<CoordinatorTrainee[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrainee, setSelectedTrainee] = useState<CoordinatorTrainee | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
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
        setSupervisors(supervisorData.filter((s) => s.companyId === cid));
      }
    } catch (err) {
      if (!signal?.aborted) {
        console.error('Failed to load trainees:', err);
        setError('Failed to load trainees');
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

  const handleAssign = (trainee: CoordinatorTrainee) => {
    setSelectedTrainee(trainee);
    setSelectedSupervisorId(trainee.supervisorId || '');
    setAssigning(true);
  };

  const handleSaveAssignment = async () => {
    if (!selectedTrainee) return;
    setSaving(true);
    try {
      await updateTraineeAssignment(selectedTrainee.traineeId, {
        supervisorId: selectedSupervisorId,
      });
      setAssigning(false);
      setSelectedTrainee(null);
      fetchData();
    } catch (err) {
      setError('Failed to update assignment');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const filteredTrainees = trainees.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    return true;
  });

  const getSupervisorName = (supervisorId?: string) => {
    if (!supervisorId) return 'Unassigned';
    return supervisors.find((s) => s.id === supervisorId)?.name || 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Manage Trainees</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor progress and assign departmental supervisors to trainees
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-4 border border-border rounded-xl space-y-2">
                <Skeleton variant="text" width="40%" height={20} />
                <Skeleton variant="text" width="60%" height={16} />
              </div>
            ))}
          </div>
        ) : filteredTrainees.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No trainees found"
              description={filterStatus ? `No trainees match the status "${filterStatus}".` : 'No trainees are registered under your department yet.'}
            />
          </div>
        ) : (
          <>
            {/* Mobile Card Layout (md:hidden) */}
            <div className="divide-y divide-border md:hidden">
              {filteredTrainees.map((trainee) => (
                <div key={trainee.traineeId} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-foreground text-sm">{trainee.name}</h4>
                      <p className="text-xs text-muted-foreground">{trainee.email}</p>
                    </div>
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                        trainee.status === 'active'
                          ? 'bg-success/15 text-success'
                          : trainee.status === 'completed'
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {trainee.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>{getSupervisorName(trainee.supervisorId)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{trainee.ojtHoursCompleted} / {trainee.ojtHoursRequired}h</span>
                    </div>
                  </div>

                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{
                        width: `${
                          trainee.ojtHoursRequired > 0
                            ? Math.min(100, (trainee.ojtHoursCompleted / trainee.ojtHoursRequired) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button variant="secondary" size="sm" onClick={() => handleAssign(trainee)}>
                      Assign Supervisor
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Layout (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Trainee
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Assigned Supervisor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      OJT Progress
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTrainees.map((trainee) => (
                    <tr key={trainee.traineeId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-foreground">{trainee.name}</div>
                        <div className="text-xs text-muted-foreground">{trainee.email}</div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
                            trainee.status === 'active'
                              ? 'bg-success/15 text-success'
                              : trainee.status === 'completed'
                              ? 'bg-primary/15 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {trainee.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">
                        {getSupervisorName(trainee.supervisorId)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-xs text-foreground font-medium">
                          {trainee.ojtHoursCompleted} / {trainee.ojtHoursRequired}h
                        </div>
                        <div className="w-28 bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{
                              width: `${
                                trainee.ojtHoursRequired > 0
                                  ? Math.min(100, (trainee.ojtHoursCompleted / trainee.ojtHoursRequired) * 100)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleAssign(trainee)}>
                          Assign
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {assigning && selectedTrainee && (
        <Modal
          open={assigning && !!selectedTrainee}
          size="md"
          title="Assign Supervisor"
          onClose={() => {
            setAssigning(false);
            setSelectedTrainee(null);
          }}
        >
          <div className="space-y-4">
            <div className="p-3 bg-muted/40 rounded-xl border border-border">
              <p className="text-xs text-muted-foreground">Trainee</p>
              <p className="font-semibold text-foreground text-sm">{selectedTrainee.name}</p>
              <p className="text-xs text-muted-foreground">{selectedTrainee.email}</p>
            </div>

            <FormField id="supervisor-select" label="Select Supervisor">
              <FormSelect
                id="supervisor-select"
                value={selectedSupervisorId}
                onValueChange={setSelectedSupervisorId}
              >
                <option value="">No Supervisor (Unassigned)</option>
                {supervisors.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name} ({sup.email})
                  </option>
                ))}
              </FormSelect>
            </FormField>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setAssigning(false);
                  setSelectedTrainee(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={handleSaveAssignment}
                isLoading={saving}
              >
                Save
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
