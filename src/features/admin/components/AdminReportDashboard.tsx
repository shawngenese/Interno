import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { DashboardCharts } from '@/features/reports/components/DashboardCharts';

const COLORS = ['var(--color-success)', 'var(--color-warning)', 'var(--color-destructive)', 'var(--color-primary)', 'var(--color-info)', 'var(--color-muted-foreground)'];

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
  trainees: { id: string; name: string }[];
  recentActivity: { id: string; action: string; timestamp: number; details: string }[];
}

export function AdminReportDashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTraineeId, setSelectedTraineeId] = useState('');
  const [analyticsRange] = useState(() => ({
    startDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
    endDate: Date.now(),
  }));

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

        const trainees = traineesSnap.docs.map(d => {
          const data = d.data() as { status?: string; ojtStatus?: string; companyId?: string; name?: string };
          return { id: d.id, ...data };
        });
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
          trainees: trainees.map(t => ({ id: t.id, name: t.name || t.id })),
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
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => window.location.reload()} className="text-sm font-medium text-destructive hover:underline min-h-[44px] px-2">Retry</button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const effectiveTraineeId = selectedTraineeId || stats.trainees[0]?.id || '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1">Analytics overview and report generation</p>
        </div>
        <Link
          to="/admin/reports/generate"
          className="px-4 py-2 min-h-[44px] inline-flex items-center bg-primary text-on-primary rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium gap-2"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Generate Report
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Trainees</p>
            <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalTrainees}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.activeTrainees} active, {stats.pendingTrainees} pending
          </p>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Completed OJT</p>
            <div className="w-11 h-11 rounded-lg bg-success/15 flex items-center justify-center">
              <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.completedTrainees}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.totalTrainees > 0 ? Math.round((stats.completedTrainees / stats.totalTrainees) * 100) : 0}% completion rate
          </p>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Tasks</p>
            <div className="w-11 h-11 rounded-lg bg-info/15 flex items-center justify-center">
              <svg className="w-4 h-4 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalTasks}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.completedTasks} completed, {stats.pendingTasks} pending
          </p>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Companies</p>
            <div className="w-11 h-11 rounded-lg bg-warning/15 flex items-center justify-center">
              <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalCompanies}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.totalSupervisors} supervisors
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Trainees by Company</h3>
          {stats.traineesByCompany.length > 0 ? (
            <ResponsiveContainer width="100%" height={250} role="img" aria-label="Bar chart showing trainees by company">
              <BarChart data={stats.traineesByCompany}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--color-primary)" name="Trainees" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No data available</p>
          )}
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">OJT Status Distribution</h3>
          {stats.traineesByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={250} role="img" aria-label="Pie chart showing OJT status distribution">
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
                  label={(props: { name?: string; value?: number }) => `${props.name}: ${props.value}`}
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
            <p className="text-center py-8 text-muted-foreground">No data available</p>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">Trainee Analytics</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Attendance, tasks and hours for the last 30 days</p>
          </div>
          <select
            value={effectiveTraineeId}
            onChange={(e) => setSelectedTraineeId(e.target.value)}
            aria-label="Select trainee for analytics"
            className="h-11 px-3 rounded-lg border border-border bg-background text-sm text-foreground min-w-[12rem]"
          >
            {stats.trainees.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {effectiveTraineeId ? (
          <DashboardCharts
            traineeId={effectiveTraineeId}
            startDate={analyticsRange.startDate}
            endDate={analyticsRange.endDate}
          />
        ) : (
          <p className="text-center py-8 text-muted-foreground">No trainees to display</p>
        )}
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Recent Activity</h3>
        {stats.recentActivity.length > 0 ? (
          <div className="space-y-3">
            {stats.recentActivity.slice(0, 10).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{activity.action}</p>
                  {activity.details && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{activity.details}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(activity.timestamp).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-muted-foreground">No recent activity</p>
        )}
      </div>
    </div>
  );
}
