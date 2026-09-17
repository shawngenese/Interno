import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { getSupervisorByUserId, getAssignedTrainees, getPendingDTRs, getTraineeAttendanceSummary } from '../services/supervisorService';
import { AnimatedCard } from '@/shared/components/AnimatedCard';
import { AnimatedList, AnimatedListItem, listItemVariants } from '@/shared/components/AnimatedList';
import type { Trainee } from '@/features/admin/types';
import type { DTREntry } from '@/features/dtr/types';

interface SupervisorInfo {
  id: string;
  userId: string;
  companyId?: string;
}

export function SupervisorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [supervisor, setSupervisor] = useState<SupervisorInfo | null>(null);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [pendingDTRs, setPendingDTRs] = useState<DTREntry[]>([]);
  const [attendance, setAttendance] = useState<Record<string, { hasTimeIn: boolean; hasTimeOut: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const sup = await getSupervisorByUserId(user.uid);
        if (sup) {
          setSupervisor(sup);
          const assignedTrainees = await getAssignedTrainees(sup.id, sup.companyId);
          setTrainees(assignedTrainees);

          const traineeIds = assignedTrainees.map(t => t.id);
          if (traineeIds.length > 0) {
            const [pending, att] = await Promise.all([
              getPendingDTRs(traineeIds).catch((err) => {
                console.warn('[SupervisorDashboard] Pending DTRs query notice:', err);
                return [];
              }),
              getTraineeAttendanceSummary(traineeIds).catch((err) => {
                console.warn('[SupervisorDashboard] Attendance summary query notice (index building):', err);
                return {};
              }),
            ]);
            setPendingDTRs(pending);
            setAttendance(att);
          } else {
            setPendingDTRs([]);
            setAttendance({});
          }
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [user?.uid]);

  const { activeTrainees, todayPresent, todayWithTimeout } = useMemo(() => {
    let present = 0;
    let withTimeout = 0;
    for (const t of trainees) {
      if (attendance[t.id]?.hasTimeIn) present++;
      if (attendance[t.id]?.hasTimeOut) withTimeout++;
    }
    return {
      activeTrainees: trainees.filter(t => t.ojtStatus === 'active'),
      todayPresent: present,
      todayWithTimeout: withTimeout,
    };
  }, [trainees, attendance]);

  const isExternal = Boolean(supervisor?.companyId && supervisor.companyId !== '');

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

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isExternal ? 'External Supervisor Dashboard' : 'Supervisor Dashboard'}
          </h2>
          {isExternal && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Viewing company-scoped trainees only
            </p>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatedCard delay={0}>
          <StatCard
            title="Assigned Trainees"
            value={trainees.length}
            subtitle={`${activeTrainees.length} active`}
            icon="users"
            color="blue"
          />
        </AnimatedCard>
        <AnimatedCard delay={0.05}>
          <StatCard
            title="Present Today"
            value={todayPresent}
            subtitle={`of ${trainees.length} trainees`}
            icon="check"
            color="green"
          />
        </AnimatedCard>
        <AnimatedCard delay={0.1}>
          <StatCard
            title="Timed Out"
            value={todayWithTimeout}
            subtitle={`of ${todayPresent} present`}
            icon="clock"
            color="purple"
          />
        </AnimatedCard>
        <AnimatedCard delay={0.15}>
          <StatCard
            title="Pending DTR Approvals"
            value={pendingDTRs.length}
            subtitle={pendingDTRs.length > 0 ? 'Needs review' : 'All caught up'}
            icon="clipboard"
            color={pendingDTRs.length > 0 ? 'yellow' : 'green'}
          />
        </AnimatedCard>
      </div>

      {/* Quick Actions */}
      <AnimatedCard delay={0.2} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/supervisor/qr')}
            className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-left"
          >
            <div className="p-2 bg-blue-100 dark:bg-blue-800/40 rounded-lg">
              <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Generate QR Code</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Create attendance QR for trainees</div>
            </div>
          </button>

          <button
            onClick={() => navigate('/supervisor/dtr')}
            className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-left"
          >
            <div className="p-2 bg-purple-100 dark:bg-purple-800/40 rounded-lg">
              <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">DTR Approvals</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Review and approve DTRs</div>
            </div>
          </button>

          <button
            onClick={() => navigate('/supervisor/trainees')}
            className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-left"
          >
            <div className="p-2 bg-green-100 dark:bg-green-800/40 rounded-lg">
              <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">View Trainees</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">See all assigned trainees</div>
            </div>
          </button>
        </div>
      </AnimatedCard>

      {/* Pending DTR Approvals */}
      {pendingDTRs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pending DTR Approvals</h3>
            <button
              onClick={() => navigate('/supervisor/dtr')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              View all
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="pb-2">Trainee</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Regular Hours</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {pendingDTRs.slice(0, 5).map(dtr => (
                  <tr key={dtr.id}>
                    <td className="py-3 text-sm text-gray-900 dark:text-white">{dtr.traineeId}</td>
                    <td className="py-3 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(dtr.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-3 text-sm text-gray-500 dark:text-gray-400">
                      {(dtr.regularMinutes / 60).toFixed(1)}h
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                        pending
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assigned Trainees */}
      <AnimatedCard delay={0.25} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assigned Trainees</h3>
          <button
            onClick={() => navigate('/supervisor/trainees')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            View all
          </button>
        </div>
        {trainees.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No trainees assigned yet.</p>
        ) : (
          <AnimatedList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trainees.slice(0, 6).map(trainee => {
              const att = attendance[trainee.id];
              return (
                <AnimatedListItem key={trainee.id} variants={listItemVariants}>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {trainee.profile?.studentId || trainee.userId}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        trainee.ojtStatus === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {trainee.ojtStatus}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <div>{trainee.profile?.course || 'No course'}</div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${att?.hasTimeIn ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                        <span>{att?.hasTimeIn ? 'Time In' : 'Not yet'}</span>
                        {att?.hasTimeOut && (
                          <>
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>Timed Out</span>
                          </>
                        )}
                      </div>
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

function StatCard({ title, value, subtitle, icon, color }: {
  title: string;
  value: number;
  subtitle: string;
  icon: 'users' | 'check' | 'clock' | 'clipboard';
  color: 'blue' | 'green' | 'purple' | 'yellow';
}) {
  const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
  };

  const icons = {
    users: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    check: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    clock: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    clipboard: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorMap[color]}`}>
          {icons[icon]}
        </div>
      </div>
    </div>
  );
}
