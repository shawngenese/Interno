import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { getCoordinatorDashboardData } from '../services/coordinatorService';
import { SkeletonCard } from '@/shared/components/Skeleton';
import { AnimatedCard } from '@/shared/components/AnimatedCard';
import { PlacementRequestList } from './PlacementRequestList';
import { CompanyVerification } from './CompanyVerification';
import { SupervisorInvite } from './SupervisorInvite';
import { CoordinatorTraineeList } from './CoordinatorTraineeList';
import { DocumentReview } from './DocumentReview';
import type { CoordinatorDashboardData } from '../types';

type TabType = 'overview' | 'placements' | 'companies' | 'invitations' | 'trainees' | 'documents';

export function CoordinatorDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<CoordinatorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const companyIdRef = useRef<string | null>(null);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime(),
    };
  });
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (!companyIdRef.current) {
        // Read companyId from ID token custom claims — already set by the
        // setUserRole Cloud Function, so no Firestore round-trip is needed
        // and we avoid a permission check on users/{uid} that can fail if
        // the token hasn't propagated yet.
        const tokenResult = await user.getIdTokenResult();
        companyIdRef.current = (tokenResult.claims.companyId as string) || '';
      }

      const dashboardData = await getCoordinatorDashboardData(
        user.uid,
        companyIdRef.current,
        period.start,
        period.end,
      );
      setData(dashboardData);
    } catch (err) {
      console.error('Failed to load coordinator dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [user, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { attendanceMap, tasksMap, documentsMap, ojtMap } = useMemo(() => {
    if (!data) return { attendanceMap: new Map(), tasksMap: new Map(), documentsMap: new Map(), ojtMap: new Map() };
    const attendanceMap = new Map(data.attendance.map((a) => [a.traineeId, a]));
    const tasksMap = new Map(data.tasks.map((t) => [t.traineeId, t]));
    const documentsMap = new Map(data.documents.map((d) => [d.traineeId, d]));
    const ojtMap = new Map(data.ojtProgress.map((p) => [p.traineeId, p]));
    return { attendanceMap, tasksMap, documentsMap, ojtMap };
  }, [data]);

  const { totalTrainees, activeTrainees, avgAttendance, avgOJT, totalMissingDocs, totalSubmittedTasks } = useMemo(() => {
    if (!data) return { totalTrainees: 0, activeTrainees: 0, avgAttendance: 0, avgOJT: 0, totalMissingDocs: 0, totalSubmittedTasks: 0 };
    const totalTrainees = data.trainees.length;
    const activeTrainees = data.trainees.filter((t) => t.status === 'active').length;
    const avgAttendance = data.attendance.length > 0
      ? Math.round(data.attendance.reduce((sum, a) => sum + (a.presentDays / a.totalDays) * 100, 0) / data.attendance.length)
      : 0;
    const avgOJT = data.ojtProgress.length > 0
      ? Math.round(data.ojtProgress.reduce((sum, p) => sum + p.percentComplete, 0) / data.ojtProgress.length)
      : 0;
    const totalMissingDocs = data.documents.reduce((sum, d) => sum + d.missingRequired.length, 0);
    const totalSubmittedTasks = data.tasks.reduce((sum, t) => sum + t.submittedTasks, 0);
    return { totalTrainees, activeTrainees, avgAttendance, avgOJT, totalMissingDocs, totalSubmittedTasks };
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-[#D5D5D5] dark:bg-[#3A3A3A] rounded animate-pulse" />
          <div className="h-8 w-32 bg-[#D5D5D5] dark:bg-[#3A3A3A] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-[#757575] dark:text-[#9E9E9E]">No data available</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#121212] dark:text-white">Coordinator Dashboard</h2>
        <div className="flex gap-2">
          <input
            type="date"
            value={new Date(period.start).toISOString().split('T')[0]}
            onChange={(e) => setPeriod((p) => ({ ...p, start: new Date(e.target.value).getTime() }))}
            aria-label="Period start date"
            className="rounded-lg border border-[#BDBDBD] dark:border-[#555555] bg-white dark:bg-[#1E1E1E] px-3 py-1.5 text-sm dark:text-white"
          />
          <input
            type="date"
            value={new Date(period.end).toISOString().split('T')[0]}
            onChange={(e) => setPeriod((p) => ({ ...p, end: new Date(e.target.value).getTime() }))}
            aria-label="Period end date"
            className="rounded-lg border border-[#BDBDBD] dark:border-[#555555] bg-white dark:bg-[#1E1E1E] px-3 py-1.5 text-sm dark:text-white"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        <nav className="flex gap-4 -mb-px overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-[#757575] dark:text-[#9E9E9E] hover:text-[#3A3A3A] dark:hover:text-[#BDBDBD] hover:border-[#BDBDBD]'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('trainees')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'trainees'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-[#757575] dark:text-[#9E9E9E] hover:text-[#3A3A3A] dark:hover:text-[#BDBDBD] hover:border-[#BDBDBD]'
            }`}
          >
            Trainees
          </button>
          <button
            onClick={() => setActiveTab('placements')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'placements'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-[#757575] dark:text-[#9E9E9E] hover:text-[#3A3A3A] dark:hover:text-[#BDBDBD] hover:border-[#BDBDBD]'
            }`}
          >
            Placement Requests
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'documents'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-[#757575] dark:text-[#9E9E9E] hover:text-[#3A3A3A] dark:hover:text-[#BDBDBD] hover:border-[#BDBDBD]'
            }`}
          >
            Documents
          </button>
          <button
            onClick={() => setActiveTab('companies')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'companies'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-[#757575] dark:text-[#9E9E9E] hover:text-[#3A3A3A] dark:hover:text-[#BDBDBD] hover:border-[#BDBDBD]'
            }`}
          >
            Verify Companies
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'invitations'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-[#757575] dark:text-[#9E9E9E] hover:text-[#3A3A3A] dark:hover:text-[#BDBDBD] hover:border-[#BDBDBD]'
            }`}
          >
            Invite Supervisors
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <AnimatedCard delay={0} className="rounded-lg border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-4">
          <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Total Trainees</p>
          <p className="text-2xl font-bold text-blue-600">{totalTrainees}</p>
          <p className="text-xs text-[#9E9E9E]">{activeTrainees} active</p>
        </AnimatedCard>
        <AnimatedCard delay={0.05} className="rounded-lg border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-4">
          <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Avg Attendance</p>
          <p className="text-2xl font-bold text-green-600">{avgAttendance}%</p>
        </AnimatedCard>
        <AnimatedCard delay={0.1} className="rounded-lg border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-4">
          <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Avg OJT Progress</p>
          <p className="text-2xl font-bold text-purple-600">{avgOJT}%</p>
        </AnimatedCard>
        <AnimatedCard delay={0.15} className="rounded-lg border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-4">
          <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Tasks Pending</p>
          <p className="text-2xl font-bold text-yellow-600">
            {totalSubmittedTasks}
          </p>
        </AnimatedCard>
        <AnimatedCard delay={0.2} className="rounded-lg border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-4">
          <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Missing Docs</p>
          <p className="text-2xl font-bold text-red-600">{totalMissingDocs}</p>
        </AnimatedCard>
      </div>

      {/* Trainee Overview Table */}
      <AnimatedCard delay={0.25} className="rounded-lg border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
          <h3 className="font-semibold text-[#121212] dark:text-white">Trainee Overview</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F5F5F5] dark:bg-[#3A3A3A]/50">
              <tr>
                <th className="px-4 py-2 text-left text-[#555555] dark:text-[#BDBDBD] font-medium">Name</th>
                <th className="px-4 py-2 text-center text-[#555555] dark:text-[#BDBDBD] font-medium">Status</th>
                <th className="px-4 py-2 text-center text-[#555555] dark:text-[#BDBDBD] font-medium">Attendance</th>
                <th className="px-4 py-2 text-center text-[#555555] dark:text-[#BDBDBD] font-medium">Tasks</th>
                <th className="px-4 py-2 text-center text-[#555555] dark:text-[#BDBDBD] font-medium">Docs</th>
                <th className="px-4 py-2 text-center text-[#555555] dark:text-[#BDBDBD] font-medium">OJT Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5D5D5] dark:divide-[#3A3A3A]">
              {data.trainees.map((trainee) => {
                const att = attendanceMap.get(trainee.traineeId);
                const task = tasksMap.get(trainee.traineeId);
                const doc = documentsMap.get(trainee.traineeId);
                const ojt = ojtMap.get(trainee.traineeId);

                return (
                  <tr key={trainee.traineeId} className="hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#121212] dark:text-white">{trainee.name}</div>
                      <div className="text-xs text-[#757575] dark:text-[#9E9E9E]">{trainee.email}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        trainee.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
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
                        {att ? `${att.lateDays} late` : ''}
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
                          className="bg-blue-600 h-1.5 rounded-full"
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
        </>
      )}

      {activeTab === 'placements' && <PlacementRequestList />}
      {activeTab === 'trainees' && <CoordinatorTraineeList />}
      {activeTab === 'documents' && <DocumentReview />}
      {activeTab === 'companies' && <CompanyVerification />}
      {activeTab === 'invitations' && <SupervisorInvite />}
    </div>
  );
}
