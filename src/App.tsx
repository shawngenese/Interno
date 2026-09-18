import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/features/auth';
import { LoginPage, UnauthorizedPage } from '@/features/auth';
import { AdminRoute, SupervisorRoute, CoordinatorRoute, TraineeRoute } from '@/features/auth';
import { LogoutButton } from '@/features/auth';
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
import { CompanyBrowser } from '@/features/trainee/components/CompanyBrowser';
import { ExternalPlacementRequest } from '@/features/trainee/components/ExternalPlacementRequest';
import { NetworkStatusIndicator } from '@/shared/components/NetworkStatus';
import { SkipToContent } from '@/shared/components/SkipToContent';
import { BottomNav } from '@/shared/components/BottomNav';
import { DashboardRedirect } from '@/shared/components/DashboardRedirect';
import { FirestoreHealthCheck } from '@/shared/components/FirestoreHealthCheck';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { PageTransition } from '@/shared/components/PageTransition';

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
                <PageTransition>
                  <AdminDashboard />
                </PageTransition>
              </AdminLayout>
            </AdminRoute>
          } />

          <Route path="/admin/audit-logs" element={
            <AdminRoute>
              <AdminLayout>
                <PageTransition>
                  <AuditLogViewer />
                </PageTransition>
              </AdminLayout>
            </AdminRoute>
          } />

          <Route path="/admin/*" element={  
            <AdminRoute>
              <AdminLayout>
                <PageTransition>
                  <AdminDashboard />
                </PageTransition>
              </AdminLayout>
            </AdminRoute>
          } />

          <Route path="/supervisor" element={
            <SupervisorRoute>
              <SupervisorLayout>
                <PageTransition>
                  <SupervisorDashboard />
                </PageTransition>
              </SupervisorLayout>
            </SupervisorRoute>
          } />

          <Route path="/supervisor/trainees" element={
            <SupervisorRoute>
              <SupervisorLayout>
                <PageTransition>
                  <SupervisorTraineeList />
                </PageTransition>
              </SupervisorLayout>
            </SupervisorRoute>
          } />

          <Route path="/supervisor/qr" element={
            <SupervisorRoute>
              <SupervisorLayout>
                <PageTransition>
                  <SupervisorQRPage />
                </PageTransition>
              </SupervisorLayout>
            </SupervisorRoute>
          } />

          <Route path="/supervisor/attendance" element={
            <SupervisorRoute>
              <SupervisorLayout>
                <PageTransition>
                  <SupervisorAttendanceMonitor />
                </PageTransition>
              </SupervisorLayout>
            </SupervisorRoute>
          } />

          <Route path="/supervisor/dtr" element={
            <SupervisorRoute>
              <SupervisorLayout>
                <PageTransition>
                  <SupervisorDTRList />
                </PageTransition>
              </SupervisorLayout>
            </SupervisorRoute>
          } />

          <Route path="/supervisor/tasks" element={
            <SupervisorRoute>
              <SupervisorLayout>
                <PageTransition>
                  <TaskList />
                </PageTransition>
              </SupervisorLayout>
            </SupervisorRoute>
          } />

          <Route path="/supervisor/leave" element={
            <SupervisorRoute>
              <SupervisorLayout>
                <PageTransition>
                  <SupervisorLeaveList />
                </PageTransition>
              </SupervisorLayout>
            </SupervisorRoute>
          } />
          
          <Route path="/coordinator" element={
            <CoordinatorRoute>
              <CoordinatorLayout>
                <PageTransition>
                  <CoordinatorDashboard />
                </PageTransition>
              </CoordinatorLayout>
            </CoordinatorRoute>
          } />

          <Route path="/coordinator/*" element={
            <CoordinatorRoute>
              <CoordinatorLayout>
                <PageTransition>
                  <CoordinatorDashboard />
                </PageTransition>
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

          <Route path="/trainee/companies" element={
            <TraineeRoute>
              <PrivateLayout>
                <CompanyBrowser />
              </PrivateLayout>
            </TraineeRoute>
          } />

          <Route path="/trainee/placement" element={
            <TraineeRoute>
              <PrivateLayout>
                <ExternalPlacementRequest />
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
  '/trainee/companies': 'Companies',
  '/trainee/placement': 'Placement',
};

function PrivateLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const pageName = PAGE_NAMES[location.pathname] || 'Dashboard';

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#121212]">
      <SkipToContent />
      <header className="bg-white dark:bg-[#1E1E1E] border-b border-[#D5D5D5] dark:border-[#3A3A3A] sticky top-0 z-40" role="banner">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-[#121212] dark:text-white">Interno</h1>
            <div className="flex items-center gap-2">
              <NetworkStatusIndicator />
              <ThemeToggle />
              <span className="text-sm text-[#555555] dark:text-[#9E9E9E] hidden sm:inline">{pageName}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>
      <main id="main-content" className="container mx-auto px-4 py-6 pb-24 lg:pb-6" role="main">
        <PageTransition>
          {children}
        </PageTransition>
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
    {
      title: 'Browse Companies',
      description: 'Find external companies for placement',
      route: '/trainee/companies',
      color: 'indigo',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      hoverColor: 'hover:bg-indigo-100 dark:hover:bg-indigo-900/30',
      iconBg: 'bg-indigo-100 dark:bg-indigo-800/40',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      title: 'My Placement',
      description: 'View your placement request status',
      route: '/trainee/placement',
      color: 'teal',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
        </svg>
      ),
      bgColor: 'bg-teal-50 dark:bg-teal-900/20',
      hoverColor: 'hover:bg-teal-100 dark:hover:bg-teal-900/30',
      iconBg: 'bg-teal-100 dark:bg-teal-800/40',
      iconColor: 'text-teal-600 dark:text-teal-400',
    },
  ];

  return (
    <PrivateLayout>
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
          <h2 className="text-2xl font-bold text-[#121212] dark:text-white">
            Welcome{user?.displayName ? `, ${user.displayName}` : ''}
          </h2>
          <p className="text-[#555555] dark:text-[#9E9E9E] mt-1">
            Here you can manage your OJT activities.
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
          <h3 className="text-lg font-semibold text-[#121212] dark:text-white mb-4">Quick Access</h3>
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
                  <div className="font-medium text-[#121212] dark:text-white">{card.title}</div>
                  <div className="text-sm text-[#757575] dark:text-[#9E9E9E]">{card.description}</div>
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