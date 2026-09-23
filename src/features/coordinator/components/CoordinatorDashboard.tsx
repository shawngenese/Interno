import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { useAuth } from '@/features/auth/AuthProvider';
import { getCoordinatorDashboardData } from '../services/coordinatorService';
import { AnimatedCard } from '@/shared/components/AnimatedCard';
import { Skeleton } from '@/shared/components/Skeleton';
import { Button } from '@/shared/components/ui/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import {
  Users,
  Clock,
  Award,
  CheckCircle2,
  Building2,
  UserPlus,
  Send,
  RefreshCw,
} from 'lucide-react';
import type { CoordinatorDashboardData } from '../types';

const TASK_STATUS_COLORS: Record<string, string> = {
  Pending: 'var(--color-warning)',
  'In Progress': 'var(--color-primary)',
  Submitted: 'var(--color-accent)',
  Approved: 'var(--color-success)',
  Returned: 'var(--color-destructive)',
};

export function CoordinatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<CoordinatorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const companyIdRef = useRef<string | null>(null);

  const period = useMemo(() => {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime(),
    };
  }, []);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      if (!companyIdRef.current) {
        const tokenResult = await user.getIdTokenResult();
        companyIdRef.current = (tokenResult.claims.companyId as string) || '';
      }

      const dashboardData = await getCoordinatorDashboardData(
        user.uid,
        companyIdRef.current,
        period.start,
        period.end,
      );
      if (!signal?.aborted) setData(dashboardData);
    } catch (err) {
      if (!signal?.aborted) {
        console.error('Failed to load coordinator dashboard:', err);
        setError('Failed to load dashboard data. Please try again.');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user, period]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const { attendanceMap, tasksMap, documentsMap, ojtMap } = useMemo(() => {
    if (!data) return { attendanceMap: new Map(), tasksMap: new Map(), documentsMap: new Map(), ojtMap: new Map() };
    const attendanceMap = new Map(data.attendance.map((a) => [a.traineeId, a]));
    const tasksMap = new Map(data.tasks.map((t) => [t.traineeId, t]));
    const documentsMap = new Map(data.documents.map((d) => [d.traineeId, d]));
    const ojtMap = new Map(data.ojtProgress.map((p) => [p.traineeId, p]));
    return { attendanceMap, tasksMap, documentsMap, ojtMap };
  }, [data]);

  const stats = useMemo(() => {
    if (!data) return { totalTrainees: 0, activeTrainees: 0, avgAttendance: 0, avgOJT: 0, totalMissingDocs: 0, totalTasks: 0, approvedTasks: 0, overdueTasks: 0, totalDocuments: 0, approvedDocuments: 0, pendingTasks: 0 };
    const totalTrainees = data.trainees.length;
    const activeTrainees = data.trainees.filter((t) => t.status === 'active').length;
    const avgAttendance = data.attendance.length > 0
      ? Math.round(data.attendance.reduce((sum, a) => sum + (a.totalDays > 0 ? (a.presentDays / a.totalDays) * 100 : 0), 0) / data.attendance.length)
      : 0;
    const avgOJT = data.ojtProgress.length > 0
      ? Math.round(data.ojtProgress.reduce((sum, p) => sum + p.percentComplete, 0) / data.ojtProgress.length)
      : 0;
    const totalMissingDocs = data.documents.reduce((sum, d) => sum + d.missingRequired.length, 0);
    const totalTasks = data.tasks.reduce((sum, t) => sum + t.totalTasks, 0);
    const approvedTasks = data.tasks.reduce((sum, t) => sum + t.approvedTasks, 0);
    const pendingTasks = data.tasks.reduce((sum, t) => sum + t.pendingTasks, 0);
    const overdueTasks = data.tasks.reduce((sum, t) => sum + t.overdueTasks, 0);
    const totalDocuments = data.documents.reduce((sum, d) => sum + d.totalDocuments, 0);
    const approvedDocuments = data.documents.reduce((sum, d) => sum + d.approvedDocuments, 0);
    return { totalTrainees, activeTrainees, avgAttendance, avgOJT, totalMissingDocs, totalTasks, approvedTasks, pendingTasks, overdueTasks, totalDocuments, approvedDocuments };
  }, [data]);

  const pipelineData = useMemo(() => {
    if (!data) return [];
    const statusMap = new Map<string, number>();
    data.trainees.forEach((t) => {
      const label = t.status.charAt(0).toUpperCase() + t.status.slice(1);
      statusMap.set(label, (statusMap.get(label) || 0) + 1);
    });
    const colorMap: Record<string, string> = {
      Active: 'var(--color-success)',
      Pending: 'var(--color-warning)',
      Completed: 'var(--color-primary)',
      Inactive: 'var(--color-muted-foreground)',
    };
    return Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
      fill: colorMap[status] || 'var(--color-muted-foreground)',
    }));
  }, [data]);

  const attendanceChartData = useMemo(() => {
    if (!data) return [];
    return data.attendance.slice(0, 8).map((a) => ({
      name: (a.traineeName || 'Unknown').split(' ')[0],
      present: a.presentDays,
      absent: Math.max(0, a.totalDays - a.presentDays),
      late: a.lateDays,
    }));
  }, [data]);

  const taskStatusData = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number>();
    data.tasks.forEach((t) => {
      if (t.pendingTasks > 0) map.set('Pending', (map.get('Pending') || 0) + t.pendingTasks);
      if (t.inProgressTasks > 0) map.set('In Progress', (map.get('In Progress') || 0) + t.inProgressTasks);
      if (t.submittedTasks > 0) map.set('Submitted', (map.get('Submitted') || 0) + t.submittedTasks);
      if (t.approvedTasks > 0) map.set('Approved', (map.get('Approved') || 0) + t.approvedTasks);
      if (t.returnedTasks > 0) map.set('Returned', (map.get('Returned') || 0) + t.returnedTasks);
    });
    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value,
      fill: TASK_STATUS_COLORS[name] || 'var(--color-muted-foreground)',
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-5 rounded-xl border border-border bg-card space-y-3">
              <Skeleton variant="text" width="60%" height={16} />
              <Skeleton variant="text" width="40%" height={28} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton variant="rectangular" height={280} className="rounded-xl" />
          <Skeleton variant="rectangular" height={280} className="rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Failed to load dashboard"
        description={error || 'Unable to connect to the server.'}
        action={{ label: 'Retry', onClick: () => { fetchData(); } }}
      />
    );
  }

  const totalForPipeline = pipelineData.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Coordinator Dashboard
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Overview of trainees, attendance, placements, and pending reviews
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => fetchData()} disabled={loading} className="self-start sm:self-auto gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Quick Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AnimatedCard delay={0} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Total Trainees</p>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{stats.totalTrainees}</p>
          <p className="text-xs text-muted-foreground mt-1">{stats.activeTrainees} actively placed</p>
        </AnimatedCard>

        <AnimatedCard delay={0.05} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Avg Attendance</p>
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-success" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{stats.avgAttendance}%</p>
          <p className="text-xs text-muted-foreground mt-1">This month</p>
        </AnimatedCard>

        <AnimatedCard delay={0.1} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Avg OJT Progress</p>
            <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
              <Award className="w-5 h-5 text-accent" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{stats.avgOJT}%</p>
          <p className="text-xs text-muted-foreground mt-1">Completed hours</p>
        </AnimatedCard>

        <AnimatedCard delay={0.15} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Pending Tasks</p>
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-warning" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{stats.pendingTasks}</p>
          <p className="text-xs text-muted-foreground mt-1">{stats.overdueTasks} overdue</p>
        </AnimatedCard>
      </div>

      {/* Quick Action Buttons */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/coordinator/assign')}
            className="flex items-start gap-4 p-5 bg-muted/30 border border-border rounded-xl hover:border-primary/50 hover:bg-muted/60 transition-all text-left cursor-pointer group"
          >
            <div className="p-3 bg-card border border-border rounded-xl group-hover:border-primary/30 transition-colors">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-foreground text-sm">Assign Trainees</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-card border border-border px-2 py-0.5 rounded-md">
                  Assign
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Place trainees with supervisors</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/coordinator/companies')}
            className="flex items-start gap-4 p-5 bg-muted/30 border border-border rounded-xl hover:border-primary/50 hover:bg-muted/60 transition-all text-left cursor-pointer group"
          >
            <div className="p-3 bg-card border border-border rounded-xl group-hover:border-primary/30 transition-colors">
              <Building2 className="h-5 w-5 text-info" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-foreground text-sm">Verify Companies</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-card border border-border px-2 py-0.5 rounded-md">
                  Verify
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Review external companies</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/coordinator/placements')}
            className="flex items-start gap-4 p-5 bg-muted/30 border border-border rounded-xl hover:border-primary/50 hover:bg-muted/60 transition-all text-left cursor-pointer group"
          >
            <div className="p-3 bg-card border border-border rounded-xl group-hover:border-primary/30 transition-colors">
              <Send className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-foreground text-sm">Placements</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-card border border-border px-2 py-0.5 rounded-md">
                  Requests
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Approve placement requests</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/coordinator/invite-supervisors')}
            className="flex items-start gap-4 p-5 bg-muted/30 border border-border rounded-xl hover:border-primary/50 hover:bg-muted/60 transition-all text-left cursor-pointer group"
          >
            <div className="p-3 bg-card border border-border rounded-xl group-hover:border-primary/30 transition-colors">
              <UserPlus className="h-5 w-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-foreground text-sm">Invite Supervisor</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-card border border-border px-2 py-0.5 rounded-md">
                  Invite
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Onboard company supervisors</p>
            </div>
          </button>
        </div>
      </div>

      {/* OJT Pipeline Bar */}
      <AnimatedCard delay={0.2} className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Trainee Status Distribution</h3>
        {totalForPipeline > 0 ? (
          <>
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
              {pipelineData.map((item) => {
                const pct = (item.count / totalForPipeline) * 100;
                return pct > 0 ? (
                  <div
                    key={item.status}
                    className="h-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: item.fill }}
                    title={`${item.status}: ${item.count}`}
                  />
                ) : null;
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {pipelineData.map((item) => (
                <div key={item.status} className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-muted-foreground">{item.status}</span>
                  <span className="font-semibold text-foreground">{item.count}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No trainees yet</p>
        )}
      </AnimatedCard>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatedCard delay={0.25} className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Weekly Attendance by Trainee</h3>
          {attendanceChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={attendanceChartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-card)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-foreground)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="present" fill="var(--color-success)" radius={[4, 4, 0, 0]} name="Present" />
                <Bar dataKey="late" fill="var(--color-warning)" radius={[4, 4, 0, 0]} name="Late" />
                <Bar dataKey="absent" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No attendance recorded</p>
          )}
        </AnimatedCard>

        <AnimatedCard delay={0.3} className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Task Status Distribution</h3>
          {taskStatusData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie
                    data={taskStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-foreground)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {taskStatusData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5 text-xs sm:text-sm">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                    <span className="text-muted-foreground">{item.name}:</span>
                    <span className="font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No task data available</p>
          )}
        </AnimatedCard>
      </div>

      {/* Trainee Overview Table */}
      <AnimatedCard delay={0.35} className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Trainee Progress Overview</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/coordinator/trainees')}>
            View All
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trainee</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attendance</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tasks</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Docs</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">OJT Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.trainees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No trainees assigned to your department.
                  </td>
                </tr>
              ) : (
                data.trainees.slice(0, 10).map((trainee) => {
                  const att = attendanceMap.get(trainee.traineeId);
                  const task = tasksMap.get(trainee.traineeId);
                  const doc = documentsMap.get(trainee.traineeId);
                  const ojt = ojtMap.get(trainee.traineeId);

                  return (
                    <tr key={trainee.traineeId} className="hover:bg-muted/40 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-medium text-foreground">{trainee.name}</div>
                        <div className="text-xs text-muted-foreground">{trainee.email}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
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
                      <td className="px-4 py-3 text-center">
                        <div className="text-foreground">
                          {att ? `${att.presentDays}/${att.totalDays}d` : '-'}
                        </div>
                        {att && att.lateDays > 0 && (
                          <div className="text-[11px] text-warning">{att.lateDays} late</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-foreground">
                          {task ? `${task.approvedTasks}/${task.totalTasks}` : '-'}
                        </div>
                        {task && task.overdueTasks > 0 && (
                          <div className="text-[11px] text-destructive">{task.overdueTasks} overdue</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-foreground">
                          {doc ? `${doc.approvedDocuments}/${doc.totalDocuments}` : '-'}
                        </div>
                        {doc && doc.missingRequired.length > 0 && (
                          <div className="text-[11px] text-destructive">{doc.missingRequired.length} missing</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="text-foreground font-medium">
                          {ojt ? `${ojt.percentComplete}%` : '0%'}
                        </div>
                        <div className="w-24 ml-auto bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${ojt?.percentComplete || 0}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AnimatedCard>
    </div>
  );
}
