import { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth';
import { getSupervisorByUserId, getAssignedTrainees, getTraineeAttendanceSummary } from '../services/supervisorService';
import { Skeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { GraduationCap, CheckCircle } from 'lucide-react';
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
          const assigned = await getAssignedTrainees(sup.id, sup.companyId);
          setTrainees(assigned);
          const att =
            assigned.length > 0
              ? await getTraineeAttendanceSummary(assigned.map((t) => t.id)).catch(() => ({}))
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
      <div className="space-y-4">
        <Skeleton variant="text" width="30%" height={28} />
        <div className="bg-card rounded-xl border border-border p-5 space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={56} className="rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-foreground">Assigned Trainees</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {trainees.length} trainee(s) currently assigned to your supervision
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {trainees.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No trainees assigned"
              description="No trainees have been assigned to you yet. Contact your coordinator if you are expecting trainees."
            />
          </div>
        ) : (
          <>
            {/* Mobile Card Layout (md:hidden) */}
            <div className="divide-y divide-border md:hidden">
              {trainees.map((trainee) => {
                const att = attendance[trainee.id];
                return (
                  <div key={trainee.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-foreground text-sm">
                          {trainee.name || trainee.profile?.studentId || 'Unnamed Trainee'}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {trainee.profile?.studentId && `${trainee.profile.studentId} • `}
                          {trainee.profile?.course || 'No course'}
                        </p>
                      </div>
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                          trainee.ojtStatus === 'active'
                            ? 'bg-success/15 text-success'
                            : trainee.ojtStatus === 'on_leave'
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {trainee.ojtStatus?.replace('_', ' ') || 'Pending'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5 truncate">
                        <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{trainee.profile?.school || 'School not set'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0 text-success" />
                        <span>
                          {att?.hasTimeIn ? (att.hasTimeOut ? 'Complete Day' : 'Timed In') : 'No Scan Today'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table Layout (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Student / Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Course
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      School
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      OJT Status
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Today's Attendance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {trainees.map((trainee) => {
                    const att = attendance[trainee.id];
                    return (
                      <tr key={trainee.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-foreground">
                            {trainee.name || trainee.profile?.studentId || '-'}
                          </div>
                          {trainee.name && trainee.profile?.studentId && (
                            <div className="text-xs text-muted-foreground">{trainee.profile.studentId}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">
                          {trainee.profile?.course || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">
                          {trainee.profile?.school || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
                              trainee.ojtStatus === 'active'
                                ? 'bg-success/15 text-success'
                                : trainee.ojtStatus === 'on_leave'
                                ? 'bg-primary/15 text-primary'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {trainee.ojtStatus?.replace('_', ' ') || 'Pending'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5 text-xs font-medium">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                att?.hasTimeIn ? 'bg-success' : 'bg-muted-foreground/40'
                              }`}
                            />
                            <span className={att?.hasTimeIn ? 'text-foreground' : 'text-muted-foreground'}>
                              {att?.hasTimeIn
                                ? att.hasTimeOut
                                  ? 'Timed Out'
                                  : 'Timed In'
                                : 'Not Started'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
