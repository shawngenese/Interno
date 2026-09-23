import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { Search, Users, Lock, CheckSquare, Square } from 'lucide-react';
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
      <div className="bg-card rounded-xl shadow-sm border border-border p-6 space-y-4">
        <Skeleton variant="text" width="50%" height={24} />
        <Skeleton variant="rectangular" height={44} className="rounded-lg" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangular" height={60} className="rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border">
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">
                Assign Trainees to {supervisorName || 'Supervisor'}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {assignedTraineeIds.length} of {allTrainees.length} trainees assigned
              {hasChanges && <span className="ml-2 text-warning font-medium">(unsaved changes)</span>}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="mx-4 md:mx-6 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search trainees by name, student ID, or course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search trainees"
              className="w-full h-10 px-4 pl-9 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
          <Button
            variant="ghost"
            onClick={handleSelectAll}
            className="border border-border shrink-0"
          >
            {assignedTraineeIds.length === filteredTrainees.length ? (
              <>
                <Square className="w-4 h-4 mr-1.5" /> Deselect All
              </>
            ) : (
              <>
                <CheckSquare className="w-4 h-4 mr-1.5" /> Select All
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-6 max-h-[50vh] overflow-y-auto">
        {filteredTrainees.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
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
                  role="button"
                  tabIndex={hasOtherSupervisor ? -1 : 0}
                  onClick={() => {
                    if (!hasOtherSupervisor) handleToggleTrainee(trainee.id);
                  }}
                  onKeyDown={(e) => {
                    if (!hasOtherSupervisor && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleToggleTrainee(trainee.id);
                    }
                  }}
                  className={`flex items-center p-3 rounded-lg border transition-colors ${
                    hasOtherSupervisor
                      ? 'bg-warning/5 border-warning/20 opacity-70 cursor-not-allowed'
                      : isRemoved
                        ? 'bg-destructive/5 border-destructive/20 opacity-60 cursor-pointer'
                        : isAssigned
                          ? 'bg-primary/10 border-primary cursor-pointer'
                          : 'bg-card border-border hover:bg-muted/50 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isAssigned}
                    disabled={hasOtherSupervisor}
                    onChange={() => handleToggleTrainee(trainee.id)}
                    aria-label={`Select ${trainee.userName || 'trainee'}`}
                    className="w-4 h-4 text-primary border-input rounded focus:ring-ring focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="ml-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold text-sm truncate ${hasOtherSupervisor ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {trainee.userName || '—'}
                      </p>
                      {hasOtherSupervisor && (
                        <span className="text-xs px-2 py-0.5 bg-warning/15 text-warning rounded-full inline-flex items-center gap-1 shrink-0">
                          <Lock className="w-3 h-3" />
                          Assigned to {otherSupName || 'another supervisor'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {trainee.profile?.studentId && `${trainee.profile.studentId} • `}
                      {trainee.profile?.course}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isNewlyAssigned && (
                      <span className="text-xs px-2 py-0.5 bg-success/15 text-success rounded-full font-semibold">
                        New
                      </span>
                    )}
                    {wasAssigned && !isNewlyAssigned && (
                      <span className="text-xs px-2 py-0.5 bg-primary/15 text-primary rounded-full font-semibold">
                        Assigned
                      </span>
                    )}
                    {isRemoved && (
                      <span className="text-xs px-2 py-0.5 bg-destructive/15 text-destructive rounded-full font-semibold">
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

      <div className="p-4 md:p-6 border-t border-border flex justify-end gap-3">
        <Button
          variant="secondary"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!hasChanges}
          isLoading={saving}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

