import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, getDocs, query, where, limit as firestoreLimit } from 'firebase/firestore';
import { AnimatedCard } from '@/shared/components/AnimatedCard';
import { AnimatedList, AnimatedListItem, listItemVariants } from '@/shared/components/AnimatedList';

interface OverviewData {
  totalUsers: number;
  totalSupervisors: number;
  totalTrainees: number;
  totalCompanies: number;
  totalDepartments: number;
  totalAuditLogs: number;
  activeTrainees: number;
  pendingTrainees: number;
  completedTrainees: number;
  onLeaveTrainees: number;
  terminatedTrainees: number;
  archivedTrainees: number;
  usersByRole: { role: string; count: number }[];
  traineesByStatus: { status: string; count: number }[];
  recentActivity: { action: string; entity: string; time: string }[];
}

const ROLE_COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#6b7280'];

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
        getDocs(query(collection(db, 'audit_logs'), where('timestamp', '>=', Date.now() - 7 * 86400000), firestoreLimit(50))),
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

      const traineesByStatusMap = new Map<string, number>();
      let activeTrainees = 0;
      let pendingTrainees = 0;
      let completedTrainees = 0;
      let onLeaveTrainees = 0;
      let terminatedTrainees = 0;
      let archivedTrainees = 0;
      traineesSnap.docs.forEach((doc) => {
        const status = doc.data().ojtStatus || 'pending';
        traineesByStatusMap.set(status, (traineesByStatusMap.get(status) || 0) + 1);
        if (status === 'active') activeTrainees++;
        if (status === 'pending') pendingTrainees++;
        if (status === 'completed') completedTrainees++;
        if (status === 'on_leave') onLeaveTrainees++;
        if (status === 'terminated') terminatedTrainees++;
        if (status === 'archived') archivedTrainees++;
      });
      const traineesByStatus = Array.from(traineesByStatusMap.entries()).map(([status, count]) => ({
        status: status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        count,
      }));

      const recentActivity = auditSnap.docs.slice(0, 5).map((doc) => {
        const d = doc.data();
        const ts = typeof d.timestamp === 'number' ? d.timestamp : d.timestamp?.seconds * 1000 || 0;
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
        totalAuditLogs: auditSnap.size,
        activeTrainees,
        pendingTrainees,
        completedTrainees,
        onLeaveTrainees,
        terminatedTrainees,
        archivedTrainees,
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

  const statCards = [
    { label: 'Total Users', value: data.totalUsers, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Supervisors', value: data.totalSupervisors, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Trainees', value: data.totalTrainees, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'Companies', value: data.totalCompanies, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
    { label: 'Departments', value: data.totalDepartments, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/20' },
    { label: 'Audit Logs', value: data.totalAuditLogs, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  ];

  const ojtCards = [
    { label: 'Active OJT', value: data.activeTrainees, color: 'text-green-600 dark:text-green-400' },
    { label: 'Pending OJT', value: data.pendingTrainees, color: 'text-yellow-600 dark:text-yellow-400' },
    { label: 'Completed OJT', value: data.completedTrainees, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'On Leave', value: data.onLeaveTrainees, color: 'text-orange-600 dark:text-orange-400' },
    { label: 'Terminated', value: data.terminatedTrainees, color: 'text-red-600 dark:text-red-400' },
    { label: 'Archived', value: data.archivedTrainees, color: 'text-gray-600 dark:text-gray-400' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">System overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card, i) => (
          <AnimatedCard key={card.label} delay={i * 0.05} className={`rounded-xl ${card.bg} border border-gray-200 dark:border-gray-700 p-4`}>
            <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </AnimatedCard>
        ))}
      </div>

      {/* OJT Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {ojtCards.map((card, i) => (
          <AnimatedCard key={card.label} delay={i * 0.05} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </AnimatedCard>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Users by Role */}
        <AnimatedCard delay={0.15} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Users by Role</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data.usersByRole}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="count"
                nameKey="role"
              >
                {data.usersByRole.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={ROLE_COLORS[index % ROLE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </AnimatedCard>

        {/* Trainees by OJT Status */}
        <AnimatedCard delay={0.2} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Trainees by OJT Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.traineesByStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
              <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AnimatedCard>
      </div>

      {/* Recent Activity */}
      <AnimatedCard delay={0.25} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Recent Activity (Last 7 Days)</h3>
        {data.recentActivity.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
        ) : (
          <AnimatedList className="space-y-3">
            {data.recentActivity.map((item, i) => (
              <AnimatedListItem key={i} variants={listItemVariants} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    item.action === 'create' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                    item.action === 'update' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                    item.action === 'delete' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {item.action}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{item.entity}</span>
                </div>
                <span className="text-gray-500 dark:text-gray-400">{item.time}</span>
              </AnimatedListItem>
            ))}
          </AnimatedList>
        )}
      </AnimatedCard>
    </div>
  );
}
