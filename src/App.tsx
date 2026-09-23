import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { LoginPage, UnauthorizedPage } from '@/features/auth';
import { NotFoundPage } from '@/features/auth';
import { AdminRoute, SupervisorRoute, CoordinatorRoute, TraineeRoute } from '@/features/auth';
import { LogoutButton } from '@/features/auth';
import { LandingPage } from '@/features/landing';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import { AdminDashboard } from '@/features/admin/components/AdminDashboard';
import { SupervisorLayout, SupervisorDashboard, SupervisorTraineeList } from '@/features/supervisor';
import { TraineeDashboard } from '@/features/trainee/components/TraineeDashboard';

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
import { CoordinatorTraineeAssignment } from '@/features/coordinator/components/CoordinatorTraineeAssignment';
import { CoordinatorTraineeList } from '@/features/coordinator/components/CoordinatorTraineeList';
import { PlacementRequestList } from '@/features/coordinator/components/PlacementRequestList';
import { CompanyVerification } from '@/features/coordinator/components/CompanyVerification';
import { SupervisorInvite } from '@/features/coordinator/components/SupervisorInvite';
import { DocumentReview } from '@/features/coordinator/components/DocumentReview';
import { CoordinatorAttendanceView } from '@/features/coordinator/components/CoordinatorAttendanceView';
import { CoordinatorTaskView } from '@/features/coordinator/components/CoordinatorTaskView';
import { AuditLogViewer } from '@/features/admin/components/AuditLogViewer';
import { EvaluationList } from '@/features/evaluations/components/EvaluationList';
import { AnnouncementList } from '@/features/announcements/components/AnnouncementList';
import { AnnouncementForm } from '@/features/announcements/components/AnnouncementForm';
import { CompanyBrowser } from '@/features/trainee/components/CompanyBrowser';
import { ExternalPlacementRequest } from '@/features/trainee/components/ExternalPlacementRequest';

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
          <Route index element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

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

          <Route path="/admin/announcements" element={
            <AdminRoute>
              <AdminLayout>
                <PageTransition>
                  <AnnouncementList role="admin" />
                </PageTransition>
              </AdminLayout>
            </AdminRoute>
          } />

          <Route path="/admin/announcements/new" element={
            <AdminRoute>
              <AdminLayout>
                <PageTransition>
                  <AnnouncementForm />
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

          <Route path="/supervisor/evaluations" element={
            <SupervisorRoute>
              <SupervisorLayout>
                <PageTransition>
                  <EvaluationList role="supervisor" />
                </PageTransition>
              </SupervisorLayout>
            </SupervisorRoute>
          } />

          <Route path="/supervisor/announcements" element={
            <SupervisorRoute>
              <SupervisorLayout>
                <PageTransition>
                  <AnnouncementList role="supervisor" />
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

          <Route path="/coordinator/assign" element={
            <CoordinatorRoute>
              <CoordinatorLayout>
                <PageTransition>
                  <CoordinatorTraineeAssignment />
                </PageTransition>
              </CoordinatorLayout>
            </CoordinatorRoute>
          } />

          <Route path="/coordinator/trainees" element={
            <CoordinatorRoute>
              <CoordinatorLayout>
                <PageTransition>
                  <CoordinatorTraineeList />
                </PageTransition>
              </CoordinatorLayout>
            </CoordinatorRoute>
          } />

          <Route path="/coordinator/placements" element={
            <CoordinatorRoute>
              <CoordinatorLayout>
                <PageTransition>
                  <PlacementRequestList />
                </PageTransition>
              </CoordinatorLayout>
            </CoordinatorRoute>
          } />

          <Route path="/coordinator/companies" element={
            <CoordinatorRoute>
              <CoordinatorLayout>
                <PageTransition>
                  <CompanyVerification />
                </PageTransition>
              </CoordinatorLayout>
            </CoordinatorRoute>
          } />

          <Route path="/coordinator/documents" element={
            <CoordinatorRoute>
              <CoordinatorLayout>
                <PageTransition>
                  <DocumentReview />
                </PageTransition>
              </CoordinatorLayout>
            </CoordinatorRoute>
          } />

          <Route path="/coordinator/attendance" element={
            <CoordinatorRoute>
              <CoordinatorLayout>
                <PageTransition>
                  <CoordinatorAttendanceView />
                </PageTransition>
              </CoordinatorLayout>
            </CoordinatorRoute>
          } />

          <Route path="/coordinator/tasks" element={
            <CoordinatorRoute>
              <CoordinatorLayout>
                <PageTransition>
                  <CoordinatorTaskView />
                </PageTransition>
              </CoordinatorLayout>
            </CoordinatorRoute>
          } />

          <Route path="/coordinator/invite-supervisors" element={
            <CoordinatorRoute>
              <CoordinatorLayout>
                <PageTransition>
                  <SupervisorInvite />
                </PageTransition>
              </CoordinatorLayout>
            </CoordinatorRoute>
          } />

          <Route path="/coordinator/evaluations" element={
            <CoordinatorRoute>
              <CoordinatorLayout>
                <PageTransition>
                  <EvaluationList role="coordinator" />
                </PageTransition>
              </CoordinatorLayout>
            </CoordinatorRoute>
          } />

          <Route path="/coordinator/announcements" element={
            <CoordinatorRoute>
              <CoordinatorLayout>
                <PageTransition>
                  <AnnouncementList role="coordinator" />
                </PageTransition>
              </CoordinatorLayout>
            </CoordinatorRoute>
          } />

          <Route path="/coordinator/announcements/new" element={
            <CoordinatorRoute>
              <CoordinatorLayout>
                <PageTransition>
                  <AnnouncementForm />
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
              <PrivateLayout>
                <TraineeDashboard />
              </PrivateLayout>
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

          <Route path="/trainee/announcements" element={
            <TraineeRoute>
              <PrivateLayout>
                <AnnouncementList role="trainee" />
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

          <Route path="*" element={<NotFoundPage />} />
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
  '/trainee/announcements': 'Announcements',
  '/trainee/leave': 'Leave',
  '/trainee/companies': 'Companies',
  '/trainee/placement': 'Placement',
};

function PrivateLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const pageName = PAGE_NAMES[location.pathname] || 'Dashboard';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SkipToContent />
      <header className="bg-card border-b border-border sticky top-0 z-40" role="banner">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <img src="/interno-logo.jpg" alt="Interno logo" className="w-8 h-8 rounded-lg bg-white object-contain shadow-sm shrink-0" />
              <h1 className="text-lg font-bold text-foreground">Interno Trainee</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:inline bg-muted px-2.5 py-1 rounded-md">
                {pageName}
              </span>
              <ThemeToggle />
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

export default App;