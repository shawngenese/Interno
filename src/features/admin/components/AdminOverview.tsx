import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, getDocs, query, limit as firestoreLimit, orderBy, type QuerySnapshot } from 'firebase/firestore';
import { AnimatedCard } from '@/shared/components/AnimatedCard';
import { AnimatedList, AnimatedListItem, listItemVariants } from '@/shared/components/AnimatedList';

interface OverviewData {
  totalUsers: number;
  totalSupervisors: number;
  totalTrainees: number;
  totalCompanies: number;
  totalDepartments: number;
  activeTrainees: number;
  pendingTrainees: number;
  completedTrainees: number;
  onLeaveTrainees: number;
  terminatedTrainees: number;
  archivedTrainees: number;
  internalTrainees: number;
  externalTrainees: number;
  usersByRole: { role: string; count: number }[];
  traineesByStatus: { status: string; count: number; fill: string }[];
  recentActivity: { action: string; entity: string; time: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  Active: '#22c55e',
  Pending: '#eab308',
  Completed: '#3b82f6',
  'On Leave': '#f97316',
  Terminated: '#ef4444',
  Archived: '#9ca3af',
};

export function AdminOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const db = getFirestoreInstancePublic();

      const [usersSnap, supervisorsSnap, traineesSnap, companiesSnap, departmentsSnap, auditSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), firestoreLimit(500))),
        getDocs(query(collection(db, 'supervisors'), firestoreLimit(500))),
        getDocs(query(collection(db, 'trainees'), firestoreLimit(500))),
        getDocs(query(collection(db, 'companies'), firestoreLimit(500))),
        getDocs(query(collection(db, 'departments'), firestoreLimit(500))),
        getDocs(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), firestoreLimit(50))).catch(() => ({ docs: [] } as unknown as QuerySnapshot)),
      ]);

      const usersByRoleMap = new Map<string, number>();
      usersSnap.docs.forEach((doc) => {
        const role = doc.data().role || 'unknown';
        usersByRoleMap.set(role, (usersByRoleMap.get(role) || 0) + 1);
      });
      const usersByRole = Array.from(usersByRoleMap.entries()).map(([role, count]) => ({
        role: role.charAt(0).toUpperCase() + role.slice(1),
        count,
      }));

      let activeTrainees = 0;
      let pendingTrainees = 0;
      let completedTrainees = 0;
      let onLeaveTrainees = 0;
      let terminatedTrainees = 0;
      let archivedTrainees = 0;
      let internalTrainees = 0;
      let externalTrainees = 0;
      const traineesByStatusMap = new Map<string, number>();

      traineesSnap.docs.forEach((doc) => {
        const d = doc.data();
        const status = d.ojtStatus || 'pending';
        traineesByStatusMap.set(status, (traineesByStatusMap.get(status) || 0) + 1);
        if (status === 'active') activeTrainees++;
        if (status === 'pending') pendingTrainees++;
        if (status === 'completed') completedTrainees++;
        if (status === 'on_leave') onLeaveTrainees++;
        if (status === 'terminated') terminatedTrainees++;
        if (status === 'archived') archivedTrainees++;
        if (d.placementType === 'external') externalTrainees++;
        else internalTrainees++;
      });

      const traineesByStatus = Array.from(traineesByStatusMap.entries()).map(([status, count]) => ({
        status: status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        count,
        fill: STATUS_COLORS[status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())] || '#BDBDBD',
      }));

      const recentActivity = auditSnap.docs.slice(0, 8).map((doc) => {
        const d = doc.data();
        let ts = 0;
        const raw = d.timestamp;
        if (typeof raw === 'number') {
          ts = raw;
        } else if (typeof raw === 'object' && raw && typeof (raw as { toDate?: () => Date }).toDate === 'function') {
          ts = (raw as { toDate: () => Date }).toDate().getTime();
        } else if (typeof raw === 'object' && raw) {
          const obj = raw as Record<string, unknown>;
          const seconds = (obj.seconds ?? obj._seconds) as number | undefined;
          const nanoseconds = (obj.nanoseconds ?? obj._nanoseconds) as number | undefined;
          if (typeof seconds === 'number') {
            ts = seconds * 1000 + Math.floor((nanoseconds ?? 0) / 1_000_000);
          }
        }
        const diff = Date.now() - ts;
        let time = 'just now';
        if (diff > 86400000) time = `${Math.floor(diff / 86400000)}d ago`;
        else if (diff > 3600000) time = `${Math.floor(diff / 3600000)}h ago`;
        else if (diff > 60000) time = `${Math.floor(diff / 60000)}m ago`;
        return {
          action: d.action || 'unknown',
          entity: d.entityType || 'unknown',
          time,
        };
      });

      setData({
        totalUsers: usersSnap.size,
        totalSupervisors: supervisorsSnap.size,
        totalTrainees: traineesSnap.size,
        totalCompanies: companiesSnap.size,
        totalDepartments: departmentsSnap.size,
        activeTrainees,
        pendingTrainees,
        completedTrainees,
        onLeaveTrainees,
        terminatedTrainees,
        archivedTrainees,
        internalTrainees,
        externalTrainees,
        usersByRole,
        traineesByStatus,
        recentActivity,
      });
    } catch (err) {
      console.error('Failed to load overview data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const totalForPipeline = data.activeTrainees + data.pendingTrainees + data.completedTrainees + data.onLeaveTrainees + data.terminatedTrainees + data.archivedTrainees;

  const placementData = [
    { name: 'Internal', value: data.internalTrainees, fill: '#3b82f6' },
    { name: 'External', value: data.externalTrainees, fill: '#8b5cf6' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#121212] dark:text-white">Dashboard</h1>
        <p className="text-[#757575] dark:text-[#9E9E9E] mt-1">System overview and key metrics</p>
      </div>

      {/* Hero Stats — Most Important */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AnimatedCard delay={0} className="rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#757575] dark:text-[#9E9E9E]">Active Trainees</p>
              <p className="text-3xl font-bold text-[#121212] dark:text-white mt-1">{data.activeTrainees}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-[#757575] dark:text-[#9E9E9E]">{data.totalTrainees} total trainees</span>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.05} className="rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#757575] dark:text-[#9E9E9E]">Pending Actions</p>
              <p className="text-3xl font-bold text-[#121212] dark:text-white mt-1">{data.pendingTrainees}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-[#757575] dark:text-[#9E9E9E]">Trainees awaiting setup</span>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.1} className="rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#757575] dark:text-[#9E9E9E]">Completed OJT</p>
              <p className="text-3xl font-bold text-[#121212] dark:text-white mt-1">{data.completedTrainees}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-[#757575] dark:text-[#9E9E9E]">
              {data.totalTrainees > 0 ? Math.round((data.completedTrainees / data.totalTrainees) * 100) : 0}% completion rate
            </span>
          </div>
        </AnimatedCard>
      </div>

      {/* OJT Pipeline — Visual Progress */}
      <AnimatedCard delay={0.15} className="rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-6">
        <h3 className="text-sm font-semibold text-[#121212] dark:text-white mb-4">OJT Pipeline</h3>
        {totalForPipeline > 0 ? (
          <>
            <div className="flex h-4 rounded-full overflow-hidden bg-[#EFEFEF] dark:bg-[#3A3A3A]">
              {data.traineesByStatus.map((item) => {
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
              {data.traineesByStatus.map((item) => (
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
        {/* Trainee Status Bar Chart */}
        <AnimatedCard delay={0.2} className="rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-6">
          <h3 className="text-sm font-semibold text-[#121212] dark:text-white mb-4">Trainee Status Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.traineesByStatus} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEFEF" vertical={false} />
              <XAxis dataKey="status" tick={{ fontSize: 10, fill: '#9E9E9E' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9E9E9E' }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D5D5D5',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.traineesByStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AnimatedCard>

        {/* Placement Type Donut */}
        <AnimatedCard delay={0.25} className="rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-6">
          <h3 className="text-sm font-semibold text-[#121212] dark:text-white mb-4">Placement Type</h3>
          {data.totalTrainees > 0 ? (
            <div className="flex items-center justify-center gap-8">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={placementData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {placementData.map((entry, index) => (
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
                {placementData.map((item) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                    <div>
                      <p className="text-sm font-medium text-[#121212] dark:text-white">{item.name}</p>
                      <p className="text-xs text-[#757575] dark:text-[#9E9E9E]">
                        {item.value} trainees ({data.totalTrainees > 0 ? Math.round((item.value / data.totalTrainees) * 100) : 0}%)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E] text-center py-8">No trainees yet</p>
          )}
        </AnimatedCard>
      </div>

      {/* Quick Counts + Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Quick Counts */}
        <div className="space-y-4">
          <AnimatedCard delay={0.3} className="rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-5">
            <h3 className="text-sm font-semibold text-[#121212] dark:text-white mb-3">Resources</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#555555] dark:text-[#9E9E9E]">Companies</span>
                </div>
                <span className="text-sm font-semibold text-[#121212] dark:text-white">{data.totalCompanies}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#555555] dark:text-[#9E9E9E]">Departments</span>
                </div>
                <span className="text-sm font-semibold text-[#121212] dark:text-white">{data.totalDepartments}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#555555] dark:text-[#9E9E9E]">Supervisors</span>
                </div>
                <span className="text-sm font-semibold text-[#121212] dark:text-white">{data.totalSupervisors}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#555555] dark:text-[#9E9E9E]">Users</span>
                </div>
                <span className="text-sm font-semibold text-[#121212] dark:text-white">{data.totalUsers}</span>
              </div>
            </div>
          </AnimatedCard>

          {/* Users by Role */}
          <AnimatedCard delay={0.35} className="rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-5">
            <h3 className="text-sm font-semibold text-[#121212] dark:text-white mb-3">Users by Role</h3>
            <div className="space-y-2">
              {data.usersByRole.map((item, i) => {
                const pct = data.totalUsers > 0 ? (item.count / data.totalUsers) * 100 : 0;
                const roleColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500'];
                return (
                  <div key={item.role}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-[#555555] dark:text-[#9E9E9E]">{item.role}</span>
                      <span className="font-medium text-[#121212] dark:text-white">{item.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#EFEFEF] dark:bg-[#3A3A3A]">
                      <div
                        className={`h-full rounded-full ${roleColors[i % roleColors.length]} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </AnimatedCard>
        </div>

        {/* Recent Activity */}
        <AnimatedCard delay={0.3} className="md:col-span-2 rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-6">
          <h3 className="text-sm font-semibold text-[#121212] dark:text-white mb-4">Recent Activity (Last 7 Days)</h3>
          {data.recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <svg className="w-10 h-10 text-[#D5D5D5] dark:text-[#555555] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">No recent activity</p>
            </div>
          ) : (
            <AnimatedList className="space-y-0">
              {data.recentActivity.map((item, i) => (
                <AnimatedListItem key={i} variants={listItemVariants}>
                  <div className="flex items-center justify-between py-3 border-b border-[#EFEFEF] dark:border-[#3A3A3A] last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        item.action === 'create' ? 'bg-green-500' :
                        item.action === 'delete' ? 'bg-red-500' :
                        item.action === 'update' ? 'bg-blue-500' :
                        'bg-gray-400'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-[#121212] dark:text-white">{item.entity}</p>
                        <p className="text-xs text-[#757575] dark:text-[#9E9E9E]">{item.action}</p>
                      </div>
                    </div>
                    <span className="text-xs text-[#9E9E9E] dark:text-[#757575] whitespace-nowrap">{item.time}</span>
                  </div>
                </AnimatedListItem>
              ))}
            </AnimatedList>
          )}
        </AnimatedCard>
      </div>
    </div>
  );
}
