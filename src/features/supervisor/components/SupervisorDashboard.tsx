import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useSupervisor } from '@/shared/hooks/useSupervisor';
import { getAssignedTrainees, getPendingDTRs, getTraineeAttendanceSummary } from '../services/supervisorService';
import { approveDTR, rejectDTR } from '@/features/dtr/services/dtrService';
import { AnimatedCard } from '@/shared/components/AnimatedCard';
import { AnimatedList, AnimatedListItem, listItemVariants } from '@/shared/components/AnimatedList';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { useToast } from '@/shared/components/Toast';
import {
  Users,
  CheckCircle,
  Clock,
  FileText,
  QrCode,
  GraduationCap,
  RefreshCw,
} from 'lucide-react';
import type { Trainee } from '@/features/admin/types';
import type { DTREntry } from '@/features/dtr/types';

export function SupervisorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { supervisor, loading: supLoading } = useSupervisor();
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [pendingDTRs, setPendingDTRs] = useState<DTREntry[]>([]);
  const [attendance, setAttendance] = useState<Record<string, { hasTimeIn: boolean; hasTimeOut: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingDtrId, setProcessingDtrId] = useState<string | null>(null);

  const traineeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of trainees) {
      map.set(t.id, t.name || t.profile?.studentId || t.userId);
    }
    return map;
  }, [trainees]);

  const loadDashboard = async () => {
    if (!supervisor) return;
    setLoading(true);
    setError(null);
    try {
      const assignedTrainees = await getAssignedTrainees(supervisor.id, supervisor.companyId);
      setTrainees(assignedTrainees);

      const traineeIds = assignedTrainees.map((t) => t.id);
      if (traineeIds.length > 0) {
        const [pending, att] = await Promise.all([
          getPendingDTRs(traineeIds).catch((err) => {
            console.warn('[SupervisorDashboard] Pending DTRs notice:', err);
            return [];
          }),
          getTraineeAttendanceSummary(traineeIds).catch((err) => {
            console.warn('[SupervisorDashboard] Attendance notice:', err);
            return {};
          }),
        ]);
        setPendingDTRs(pending);
        setAttendance(att);
      } else {
        setPendingDTRs([]);
        setAttendance({});
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || supLoading || !supervisor) {
      if (!supLoading) setLoading(false);
      return;
    }
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, supLoading, supervisor]);

  const { activeTrainees, todayPresent, todayWithTimeout } = useMemo(() => {
    let present = 0;
    let withTimeout = 0;
    for (const t of trainees) {
      if (attendance[t.id]?.hasTimeIn) present++;
      if (attendance[t.id]?.hasTimeOut) withTimeout++;
    }
    return {
      activeTrainees: trainees.filter((t) => t.ojtStatus === 'active'),
      todayPresent: present,
      todayWithTimeout: withTimeout,
    };
  }, [trainees, attendance]);

  const handleInlineApprove = async (dtrId: string) => {
    setProcessingDtrId(dtrId);
    try {
      await approveDTR(dtrId);
      addToast('success', 'DTR approved');
      setPendingDTRs((prev) => prev.filter((d) => d.id !== dtrId));
    } catch (err) {
      console.error(err);
      addToast('error', 'Failed to approve DTR');
    } finally {
      setProcessingDtrId(null);
    }
  };

  const handleInlineReject = async (dtrId: string) => {
    setProcessingDtrId(dtrId);
    try {
      await rejectDTR(dtrId);
      addToast('success', 'DTR rejected');
      setPendingDTRs((prev) => prev.filter((d) => d.id !== dtrId));
    } catch (err) {
      console.error(err);
      addToast('error', 'Failed to reject DTR');
    } finally {
      setProcessingDtrId(null);
    }
  };

  const isExternal = !supervisor?.companyId || supervisor.companyId === '';

  if (loading || supLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-5 rounded-xl border border-border bg-card space-y-3">
              <Skeleton variant="text" width="60%" height={16} />
              <Skeleton variant="text" width="40%" height={28} />
            </div>
          ))}
        </div>
        <Skeleton variant="rectangular" height={160} className="rounded-xl" />
        <Skeleton variant="rectangular" height={240} className="rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load dashboard"
        description={error}
        action={{ label: 'Retry', onClick: () => { loadDashboard(); } }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {isExternal ? 'External Supervisor Dashboard' : 'Supervisor Dashboard'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isExternal
              ? 'Viewing company-scoped trainees only'
              : 'Overview of assigned trainees, attendance, and pending daily time records'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={loadDashboard} disabled={loading} className="self-start sm:self-auto gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatedCard delay={0} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Assigned Trainees</p>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{trainees.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{activeTrainees.length} actively placed</p>
        </AnimatedCard>

        <AnimatedCard delay={0.05} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Present Today</p>
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center text-success">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{todayPresent}</p>
          <p className="text-xs text-muted-foreground mt-1">of {trainees.length} trainees</p>
        </AnimatedCard>

        <AnimatedCard delay={0.1} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Timed Out Today</p>
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{todayWithTimeout}</p>
          <p className="text-xs text-muted-foreground mt-1">of {todayPresent} present</p>
        </AnimatedCard>

        <AnimatedCard delay={0.15} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Pending DTRs</p>
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center text-warning">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{pendingDTRs.length}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {pendingDTRs.length > 0 ? 'Needs review' : 'All caught up'}
          </p>
        </AnimatedCard>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/supervisor/qr')}
            className="flex items-start gap-4 p-5 bg-muted/30 border border-border rounded-xl hover:border-primary/50 hover:bg-muted/60 transition-all text-left cursor-pointer group"
          >
            <div className="p-3 bg-card border border-border rounded-xl group-hover:border-primary/30 transition-colors">
              <QrCode className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-foreground text-sm">Generate QR Code</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-card border border-border px-2 py-0.5 rounded-md">
                  QR Code
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Display attendance scanner QR</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/supervisor/dtr')}
            className="flex items-start gap-4 p-5 bg-muted/30 border border-border rounded-xl hover:border-primary/50 hover:bg-muted/60 transition-all text-left cursor-pointer group"
          >
            <div className="p-3 bg-card border border-border rounded-xl group-hover:border-primary/30 transition-colors">
              <FileText className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-foreground text-sm">Review DTRs</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-card border border-border px-2 py-0.5 rounded-md">
                  DTR
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Approve daily time records</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/supervisor/trainees')}
            className="flex items-start gap-4 p-5 bg-muted/30 border border-border rounded-xl hover:border-primary/50 hover:bg-muted/60 transition-all text-left cursor-pointer group"
          >
            <div className="p-3 bg-card border border-border rounded-xl group-hover:border-primary/30 transition-colors">
              <GraduationCap className="h-5 w-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-foreground text-sm">View Trainees</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-card border border-border px-2 py-0.5 rounded-md">
                  Roster
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">See assigned trainee roster</p>
            </div>
          </button>
        </div>
      </div>

      {/* Pending DTR Approvals Table */}
      {pendingDTRs.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Pending DTR Approvals</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Quick actions to approve or reject submissions</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/supervisor/dtr')}>
              View All ({pendingDTRs.length})
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trainee</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hours</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingDTRs.slice(0, 5).map((dtr) => (
                  <tr key={dtr.id} className="h-[44px] hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-2 font-medium text-foreground">
                      {traineeNameMap.get(dtr.traineeId) || dtr.traineeId}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(dtr.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-2 text-xs text-foreground font-medium">
                      {(dtr.regularMinutes / 60).toFixed(1)}h
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-warning/15 text-warning">
                        pending
                      </span>
                    </td>
                    <td className="px-5 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => handleInlineReject(dtr.id)}
                          isLoading={processingDtrId === dtr.id}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => handleInlineApprove(dtr.id)}
                          isLoading={processingDtrId === dtr.id}
                        >
                          Approve
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assigned Trainees */}
      <AnimatedCard delay={0.25} className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Assigned Trainees</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Real-time attendance and OJT progress</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/supervisor/trainees')}>
            View All
          </Button>
        </div>

        {trainees.length === 0 ? (
          <EmptyState
            title="No trainees assigned"
            description="No trainees assigned yet. Contact your coordinator."
          />
        ) : (
          <AnimatedList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trainees.slice(0, 6).map((trainee) => {
              const att = attendance[trainee.id];
              return (
                <AnimatedListItem key={trainee.id} variants={listItemVariants}>
                  <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3 hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-foreground text-sm truncate">
                          {trainee.name || trainee.profile?.studentId || trainee.userId}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {trainee.profile?.course || 'No course specified'}
                        </p>
                      </div>
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full shrink-0 ${
                          trainee.ojtStatus === 'active'
                            ? 'bg-success/15 text-success'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {trainee.ojtStatus}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-border text-xs text-muted-foreground">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          att?.hasTimeIn ? 'bg-success' : 'bg-muted-foreground/40'
                        }`}
                      />
                      <span>{att?.hasTimeIn ? 'Timed In' : 'No time-in today'}</span>
                      {att?.hasTimeOut && (
                        <>
                          <span className="text-border">•</span>
                          <span className="text-primary font-medium">Timed Out</span>
                        </>
                      )}
                    </div>
                  </div>
                </AnimatedListItem>
              );
            })}
          </AnimatedList>
        )}
      </AnimatedCard>
    </div>
  );
}
