import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#22c55e', '#eab308', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

interface OverviewStats {
  totalTrainees: number;
  activeTrainees: number;
  pendingTrainees: number;
  completedTrainees: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  totalCompanies: number;
  totalSupervisors: number;
  traineesByCompany: { name: string; count: number }[];
  traineesByStatus: { status: string; count: number }[];
  recentActivity: { id: string; action: string; timestamp: number; details: string }[];
}

export function AdminReportDashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const db = getFirestoreInstancePublic();

        const [traineesSnap, tasksSnap, companiesSnap, supervisorsSnap, auditSnap] = await Promise.all([
          getDocs(query(collection(db, 'trainees'))),
          getDocs(query(collection(db, 'tasks'))),
          getDocs(query(collection(db, 'companies'))),
          getDocs(query(collection(db, 'supervisors'))),
          getDocs(query(
            collection(db, 'audit_logs'),
            orderBy('timestamp', 'desc'),
            limit(20),
          )).catch(() => ({ docs: [] })),
        ]);

        const trainees = traineesSnap.docs.map(d => d.data());
        const tasks = tasksSnap.docs.map(d => d.data());

        const activeTrainees = trainees.filter(t => t.status === 'active').length;
        const pendingTrainees = trainees.filter(t => t.status === 'pending').length;
        const completedTrainees = trainees.filter(t => t.ojtStatus === 'completed').length;

        const completedTasks = tasks.filter(t => t.status === 'approved').length;
        const pendingTasks = tasks.filter(t => t.status !== 'approved').length;

        const companiesSnap2 = await getDocs(collection(db, 'companies'));
        const companyNameMap: Record<string, string> = {};
        companiesSnap2.docs.forEach(d => {
          companyNameMap[d.id] = d.data().name || d.id;
        });

        const companyCount: Record<string, number> = {};
        trainees.forEach(t => {
          const cid = t.companyId || 'Unassigned';
          companyCount[cid] = (companyCount[cid] || 0) + 1;
        });
        const traineesByCompany = Object.entries(companyCount).map(([cid, count]) => ({
          name: companyNameMap[cid] || cid,
          count,
        }));

        const statusCount: Record<string, number> = {};
        trainees.forEach(t => {
          const status = t.ojtStatus || 'pending';
          statusCount[status] = (statusCount[status] || 0) + 1;
        });
        const traineesByStatus = Object.entries(statusCount).map(([status, count]) => ({
          status,
          count,
        }));

        const recentActivity = auditSnap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            action: data.action || 'Unknown',
            timestamp: data.timestamp?.seconds ? data.timestamp.seconds * 1000 : data.timestamp || 0,
            details: data.details || data.description || '',
          };
        }).filter(a => a.timestamp > 0);

        setStats({
          totalTrainees: trainees.length,
          activeTrainees,
          pendingTrainees,
          completedTrainees,
          totalTasks: tasks.length,
          completedTasks,
          pendingTasks,
          totalCompanies: companiesSnap.size,
          totalSupervisors: supervisorsSnap.size,
          traineesByCompany,
          traineesByStatus,
          recentActivity,
        });
      } catch (err) {
        console.error('Failed to load report stats:', err);
        setError('Failed to load report data. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-[#EFEFEF] dark:bg-[#3A3A3A] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-[#EFEFEF] dark:bg-[#3A3A3A] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => window.location.reload()} className="text-sm font-medium text-red-700 dark:text-red-400 hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#121212] dark:text-white">Reports</h1>
          <p className="text-[#555555] dark:text-[#9E9E9E] mt-1">Analytics overview and report generation</p>
        </div>
        <Link
          to="/admin/reports/generate"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium inline-flex items-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Generate Report
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Total Trainees</p>
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-[#121212] dark:text-white">{stats.totalTrainees}</p>
          <p className="text-xs text-[#757575] dark:text-[#9E9E9E] mt-1">
            {stats.activeTrainees} active, {stats.pendingTrainees} pending
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Completed OJT</p>
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-[#121212] dark:text-white">{stats.completedTrainees}</p>
          <p className="text-xs text-[#757575] dark:text-[#9E9E9E] mt-1">
            {stats.totalTrainees > 0 ? Math.round((stats.completedTrainees / stats.totalTrainees) * 100) : 0}% completion rate
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Total Tasks</p>
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-[#121212] dark:text-white">{stats.totalTasks}</p>
          <p className="text-xs text-[#757575] dark:text-[#9E9E9E] mt-1">
            {stats.completedTasks} completed, {stats.pendingTasks} pending
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Companies</p>
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-[#121212] dark:text-white">{stats.totalCompanies}</p>
          <p className="text-xs text-[#757575] dark:text-[#9E9E9E] mt-1">
            {stats.totalSupervisors} supervisors
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-5">
          <h3 className="text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-4">Trainees by Company</h3>
          {stats.traineesByCompany.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.traineesByCompany}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" name="Trainees" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-8 text-[#757575] dark:text-[#9E9E9E]">No data available</p>
          )}
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-5">
          <h3 className="text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-4">OJT Status Distribution</h3>
          {stats.traineesByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats.traineesByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="status"
                  label={({ status, count }) => `${status}: ${count}`}
                >
                  {stats.traineesByStatus.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-8 text-[#757575] dark:text-[#9E9E9E]">No data available</p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-5">
        <h3 className="text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-4">Recent Activity</h3>
        {stats.recentActivity.length > 0 ? (
          <div className="space-y-3">
            {stats.recentActivity.slice(0, 10).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-lg">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#121212] dark:text-white">{activity.action}</p>
                  {activity.details && (
                    <p className="text-xs text-[#757575] dark:text-[#9E9E9E] mt-0.5 truncate">{activity.details}</p>
                  )}
                </div>
                <span className="text-xs text-[#757575] dark:text-[#9E9E9E] whitespace-nowrap">
                  {new Date(activity.timestamp).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-[#757575] dark:text-[#9E9E9E]">No recent activity</p>
        )}
      </div>
    </div>
  );
}
