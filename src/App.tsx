import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/features/auth';
import { LoginPage, UnauthorizedPage } from '@/features/auth';
import { AdminRoute, CoordinatorRoute, TraineeRoute } from '@/features/auth';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import { AdminDashboard } from '@/features/admin/components/AdminDashboard';
import { SupervisorLayout, SupervisorDashboard, SupervisorTraineeList } from '@/features/supervisor';
import { SupervisorQRPage } from '@/features/attendance/components/SupervisorQRPage';
import { SupervisorAttendanceMonitor } from '@/features/attendance/components/SupervisorAttendanceMonitor';
import { SupervisorDTRList } from '@/features/dtr/components/SupervisorDTRList';
import { TaskList } from '@/features/tasks/components/TaskList';
import { MyTasks } from '@/features/tasks/components/MyTasks';
import { SupervisorLeaveList } from '@/features/leave/components/SupervisorLeaveList';
import { TraineeLeaveView } from '@/features/leave/components/TraineeLeaveView';
import { TraineeAttendance } from '@/features/attendance/components/TraineeAttendance';
import { TraineeDTRView } from '@/features/dtr/components/TraineeDTRView';
import { DocumentList } from '@/features/documents/components/DocumentList';
import { CoordinatorDashboard } from '@/features/coordinator/components/CoordinatorDashboard';
import { CoordinatorLayout } from '@/features/coordinator/components/CoordinatorLayout';
import { AuditLogViewer } from '@/features/admin/components/AuditLogViewer';
import { NetworkStatusIndicator } from '@/shared/components/NetworkStatus';
import { SkipToContent } from '@/shared/components/SkipToContent';
import { BottomNav } from '@/shared/components/BottomNav';
import { DashboardRedirect } from '@/shared/components/DashboardRedirect';
import { FirestoreHealthCheck } from '@/shared/components/FirestoreHealthCheck';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FirestoreHealthCheck />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          
          <Route index element={<DashboardRedirect />} />

          <Route path="/admin" element={
            <AdminRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </AdminRoute>
          } />

          <Route path="/admin/audit-logs" element={
            <AdminRoute>
              <AdminLayout>
                <AuditLogViewer />
              </AdminLayout>
            </AdminRoute>
          } />

          <Route path="/admin/*" element={  
            <AdminRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </AdminRoute>
          } />

          <Route path="/supervisor" element={
            <SupervisorLayout>
              <SupervisorDashboard />
            </SupervisorLayout>
          } />

          <Route path="/supervisor/trainees" element={
            <SupervisorLayout>
              <SupervisorTraineeList />
            </SupervisorLayout>
          } />

          <Route path="/supervisor/qr" element={
            <SupervisorLayout>
              <SupervisorQRPage />
            </SupervisorLayout>
          } />

          <Route path="/supervisor/attendance" element={
            <SupervisorLayout>
              <SupervisorAttendanceMonitor />
            </SupervisorLayout>
          } />

          <Route path="/supervisor/dtr" element={
            <SupervisorLayout>
              <SupervisorDTRList />
            </SupervisorLayout>
          } />

          <Route path="/supervisor/tasks" element={
            <SupervisorLayout>
              <TaskList />
            </SupervisorLayout>
          } />

          <Route path="/supervisor/leave" element={
            <SupervisorLayout>
              <SupervisorLeaveList />
            </SupervisorLayout>
          } />
          
          <Route path="/coordinator" element={
            <CoordinatorRoute>
              <CoordinatorLayout>
                <CoordinatorDashboard />
              </CoordinatorLayout>
            </CoordinatorRoute>
          } />

          <Route path="/coordinator/*" element={
            <CoordinatorRoute>
              <CoordinatorLayout>
                <CoordinatorDashboard />
              </CoordinatorLayout>
            </CoordinatorRoute>
          } />
          
          <Route path="/trainee" element={
            <TraineeRoute>
              <TraineeDashboard />
            </TraineeRoute>
          } />

          <Route path="/trainee/tasks" element={
            <TraineeRoute>
              <PrivateLayout>
                <MyTasks />
              </PrivateLayout>
            </TraineeRoute>
          } />

          <Route path="/trainee/leave" element={
            <TraineeRoute>
              <PrivateLayout>
                <TraineeLeaveView />
              </PrivateLayout>
            </TraineeRoute>
          } />

          <Route path="/trainee/attendance" element={
            <TraineeRoute>
              <PrivateLayout>
                <TraineeAttendance />
              </PrivateLayout>
            </TraineeRoute>
          } />

          <Route path="/trainee/dtr" element={
            <TraineeRoute>
              <PrivateLayout>
                <TraineeDTRView />
              </PrivateLayout>
            </TraineeRoute>
          } />

          <Route path="/trainee/documents" element={
            <TraineeRoute>
              <PrivateLayout>
                <DocumentList />
              </PrivateLayout>
            </TraineeRoute>
          } />

          <Route path="/dashboard" element={<DashboardRedirect />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

const PAGE_NAMES: Record<string, string> = {
  '/trainee': 'Dashboard',
  '/trainee/attendance': 'Attendance',
  '/trainee/tasks': 'Tasks',
  '/trainee/dtr': 'DTR',
  '/trainee/documents': 'Documents',
  '/trainee/leave': 'Leave',
};

function PrivateLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const pageName = PAGE_NAMES[location.pathname] || 'Dashboard';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SkipToContent />
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40" role="banner">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Interno</h1>
            <div className="flex items-center gap-4">
              <NetworkStatusIndicator />
              <nav className="flex items-center gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">{pageName}</span>
              </nav>
            </div>
          </div>
        </div>
      </header>
      <main id="main-content" className="container mx-auto px-4 py-6" role="main">
        {children}
      </main>
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

function TraineeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const cards = [
    {
      title: 'Attendance',
      description: 'View your attendance history',
      route: '/trainee/attendance',
      color: 'blue',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      hoverColor: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
      iconBg: 'bg-blue-100 dark:bg-blue-800/40',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Tasks',
      description: 'View and manage your tasks',
      route: '/trainee/tasks',
      color: 'green',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      hoverColor: 'hover:bg-green-100 dark:hover:bg-green-900/30',
      iconBg: 'bg-green-100 dark:bg-green-800/40',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'DTR',
      description: 'View your daily time record',
      route: '/trainee/dtr',
      color: 'purple',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      hoverColor: 'hover:bg-purple-100 dark:hover:bg-purple-900/30',
      iconBg: 'bg-purple-100 dark:bg-purple-800/40',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      title: 'Documents',
      description: 'Access your submitted documents',
      route: '/trainee/documents',
      color: 'yellow',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      hoverColor: 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30',
      iconBg: 'bg-yellow-100 dark:bg-yellow-800/40',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
    },
  ];

  return (
    <PrivateLayout>
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome{user?.displayName ? `, ${user.displayName}` : ''}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Here you can manage your OJT activities.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Access</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cards.map((card) => (
              <button
                key={card.title}
                onClick={() => navigate(card.route)}
                className={`flex items-center gap-3 p-4 ${card.bgColor} rounded-lg ${card.hoverColor} transition-colors text-left`}
              >
                <div className={`p-2 ${card.iconBg} rounded-lg`}>
                  <span className={card.iconColor}>{card.icon}</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{card.title}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{card.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </PrivateLayout>
  );
}

export default App;