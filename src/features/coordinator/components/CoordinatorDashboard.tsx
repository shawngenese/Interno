import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { useAuth } from '@/features/auth/AuthProvider';
import { getCoordinatorDashboardData } from '../services/coordinatorService';
import { AnimatedCard } from '@/shared/components/AnimatedCard';
import type { CoordinatorDashboardData } from '../types';

const TASK_STATUS_COLORS: Record<string, string> = {
  Pending: '#eab308',
  'In Progress': '#3b82f6',
  Submitted: '#8b5cf6',
  Approved: '#22c55e',
  Returned: '#f97316',
};

export function CoordinatorDashboard() {
  const { user } = useAuth();
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
    if (!data) return { totalTrainees: 0, activeTrainees: 0, avgAttendance: 0, avgOJT: 0, totalMissingDocs: 0, totalTasks: 0, approvedTasks: 0, overdueTasks: 0, totalDocuments: 0, approvedDocuments: 0 };
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
    const overdueTasks = data.tasks.reduce((sum, t) => sum + t.overdueTasks, 0);
    const totalDocuments = data.documents.reduce((sum, d) => sum + d.totalDocuments, 0);
    const approvedDocuments = data.documents.reduce((sum, d) => sum + d.approvedDocuments, 0);
    return { totalTrainees, activeTrainees, avgAttendance, avgOJT, totalMissingDocs, totalTasks, approvedTasks, overdueTasks, totalDocuments, approvedDocuments };
  }, [data]);

  const pipelineData = useMemo(() => {
    if (!data) return [];
    const statusMap = new Map<string, number>();
    data.trainees.forEach((t) => {
      const label = t.status.charAt(0).toUpperCase() + t.status.slice(1);
      statusMap.set(label, (statusMap.get(label) || 0) + 1);
    });
    const colorMap: Record<string, string> = {
      Active: '#22c55e',
      Pending: '#eab308',
      Completed: '#3b82f6',
      Inactive: '#9ca3af',
    };
    return Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
      fill: colorMap[status] || '#BDBDBD',
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
      fill: TASK_STATUS_COLORS[name] || '#BDBDBD',
    }));
  }, [data]);

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

  if (!data) {
    return error ? (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          <button
            onClick={() => { setError(null); fetchData(); }}
            className="mt-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            Retry
          </button>
        </div>
      </div>
    ) : null;
  }

  const totalForPipeline = pipelineData.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#121212] dark:text-white">Dashboard</h1>
        <p className="text-[#757575] dark:text-[#9E9E9E] mt-1">Trainee overview and key metrics</p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AnimatedCard delay={0} className="rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#757575] dark:text-[#9E9E9E]">Total Trainees</p>
              <p className="text-3xl font-bold text-[#121212] dark:text-white mt-1">{stats.totalTrainees}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-[#757575] dark:text-[#9E9E9E]">{stats.activeTrainees} active</span>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.05} className="rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#757575] dark:text-[#9E9E9E]">Avg Attendance</p>
              <p className="text-3xl font-bold text-[#121212] dark:text-white mt-1">{stats.avgAttendance}%</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-[#757575] dark:text-[#9E9E9E]">Across all trainees</span>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.1} className="rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#757575] dark:text-[#9E9E9E]">Avg OJT Progress</p>
              <p className="text-3xl font-bold text-[#121212] dark:text-white mt-1">{stats.avgOJT}%</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-[#757575] dark:text-[#9E9E9E]">
              {stats.totalMissingDocs > 0 ? `${stats.totalMissingDocs} missing docs` : 'All docs complete'}
            </span>
          </div>
        </AnimatedCard>
      </div>

      {/* OJT Pipeline */}
      <AnimatedCard delay={0.15} className="rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-6">
        <h3 className="text-sm font-semibold text-[#121212] dark:text-white mb-4">OJT Pipeline</h3>
        {totalForPipeline > 0 ? (
          <>
            <div className="flex h-4 rounded-full overflow-hidden bg-[#EFEFEF] dark:bg-[#3A3A3A]">
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
                <div key={item.status} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-[#555555] dark:text-[#9E9E9E]">{item.status}</span>
                  <span className="font-semibold text-[#121212] dark:text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">No trainees yet</p>
        )}
      </AnimatedCard>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatedCard delay={0.2} className="rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-6">
          <h3 className="text-sm font-semibold text-[#121212] dark:text-white mb-4">Attendance Overview</h3>
          {attendanceChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={attendanceChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEFEF" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9E9E9E' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9E9E9E' }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #D5D5D5',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="present" fill="#22c55e" radius={[4, 4, 0, 0]} name="Present" />
                <Bar dataKey="late" fill="#eab308" radius={[4, 4, 0, 0]} name="Late" />
                <Bar dataKey="absent" fill="#ef4444" radius={[4, 4, 0, 0]} name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E] text-center py-8">No attendance data</p>
          )}
        </AnimatedCard>

        <AnimatedCard delay={0.25} className="rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-6">
          <h3 className="text-sm font-semibold text-[#121212] dark:text-white mb-4">Task Status Distribution</h3>
          {taskStatusData.length > 0 ? (
            <div className="flex items-center justify-center gap-8">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={taskStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D5D5D5',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {taskStatusData.map((item) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                    <div>
                      <p className="text-sm font-medium text-[#121212] dark:text-white">{item.name}</p>
                      <p className="text-xs text-[#757575] dark:text-[#9E9E9E]">{item.value} tasks</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E] text-center py-8">No tasks yet</p>
          )}
        </AnimatedCard>
      </div>

      {/* Bottom Section: Summary + Trainee Table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <AnimatedCard delay={0.3} className="rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-5">
            <h3 className="text-sm font-semibold text-[#121212] dark:text-white mb-3">Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#555555] dark:text-[#9E9E9E]">Overdue Tasks</span>
                </div>
                <span className="text-sm font-semibold text-[#121212] dark:text-white">{stats.overdueTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#555555] dark:text-[#9E9E9E]">Tasks Approved</span>
                </div>
                <span className="text-sm font-semibold text-[#121212] dark:text-white">{stats.approvedTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#555555] dark:text-[#9E9E9E]">Total Documents</span>
                </div>
                <span className="text-sm font-semibold text-[#121212] dark:text-white">{stats.totalDocuments}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#555555] dark:text-[#9E9E9E]">Missing Docs</span>
                </div>
                <span className="text-sm font-semibold text-[#121212] dark:text-white">{stats.totalMissingDocs}</span>
              </div>
            </div>
          </AnimatedCard>
        </div>

        <AnimatedCard delay={0.3} className="md:col-span-2 rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
            <h3 className="text-sm font-semibold text-[#121212] dark:text-white">Trainee Overview</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F5F5F5] dark:bg-[#3A3A3A]/50">
                <tr>
                  <th className="px-6 py-3 text-left text-[#555555] dark:text-[#BDBDBD] font-medium">Name</th>
                  <th className="px-4 py-3 text-center text-[#555555] dark:text-[#BDBDBD] font-medium">Status</th>
                  <th className="px-4 py-3 text-center text-[#555555] dark:text-[#BDBDBD] font-medium">Attendance</th>
                  <th className="px-4 py-3 text-center text-[#555555] dark:text-[#BDBDBD] font-medium">Tasks</th>
                  <th className="px-4 py-3 text-center text-[#555555] dark:text-[#BDBDBD] font-medium">Docs</th>
                  <th className="px-4 py-3 text-center text-[#555555] dark:text-[#BDBDBD] font-medium">OJT Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5D5D5] dark:divide-[#3A3A3A]">
                {data.trainees.map((trainee) => {
                  const att = attendanceMap.get(trainee.traineeId);
                  const task = tasksMap.get(trainee.traineeId);
                  const doc = documentsMap.get(trainee.traineeId);
                  const ojt = ojtMap.get(trainee.traineeId);

                  return (
                    <tr key={trainee.traineeId} className="hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/30 transition-colors">
                      <td className="px-6 py-3">
                        <div className="font-medium text-[#121212] dark:text-white">{trainee.name}</div>
                        <div className="text-xs text-[#757575] dark:text-[#9E9E9E]">{trainee.email}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          trainee.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : trainee.status === 'completed'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-[#EFEFEF] text-[#555555] dark:bg-[#3A3A3A] dark:text-[#9E9E9E]'
                        }`}>
                          {trainee.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-[#121212] dark:text-white">
                          {att ? `${att.presentDays}/${att.totalDays}` : '-'}
                        </div>
                        <div className="text-xs text-[#757575] dark:text-[#9E9E9E]">
                          {att && att.lateDays > 0 ? `${att.lateDays} late` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-[#121212] dark:text-white">
                          {task ? `${task.approvedTasks}/${task.totalTasks}` : '-'}
                        </div>
                        <div className="text-xs text-[#757575] dark:text-[#9E9E9E]">
                          {task && task.overdueTasks > 0 ? `${task.overdueTasks} overdue` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-[#121212] dark:text-white">
                          {doc ? `${doc.approvedDocuments}/${doc.totalDocuments}` : '-'}
                        </div>
                        <div className="text-xs text-red-500 dark:text-red-400">
                          {doc && doc.missingRequired.length > 0 ? `${doc.missingRequired.length} missing` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-[#121212] dark:text-white">
                          {ojt ? `${ojt.completed}/${ojt.required}h` : '-'}
                        </div>
                        <div className="w-full bg-[#D5D5D5] dark:bg-[#3A3A3A] rounded-full h-1.5 mt-1">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${ojt?.percentComplete || 0}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AnimatedCard>
      </div>
    </div>
  );
}
