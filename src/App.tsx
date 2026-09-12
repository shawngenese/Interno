import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { LoginPage, UnauthorizedPage } from '@/features/auth';
import { AdminRoute, SupervisorRoute, CoordinatorRoute, TraineeRoute } from '@/features/auth';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import { AdminDashboard } from '@/features/admin/components/AdminDashboard';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          
          <Route element={<Navigate to="/dashboard" replace />}>
            <Route index />
          </Route>

          <Route path="/admin/*" element={
            <AdminRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </AdminRoute>
          } />
          
          <Route path="/admin" element={
            <AdminRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </AdminRoute>
          } />
          
          <Route path="/admin/users" element={
            <AdminRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </AdminRoute>
          } />
          
          <Route path="/admin/users/:id" element={
            <AdminRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </AdminRoute>
          } />
          
          <Route path="/admin/users/create" element={
            <AdminRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </AdminRoute>
          } />

          <Route path="/supervisor/*" element={
            <SupervisorRoute>
              <SupervisorDashboard />
            </SupervisorRoute>
          } />
          
          <Route path="/coordinator/*" element={
            <CoordinatorRoute>
              <CoordinatorDashboard />
            </CoordinatorRoute>
          } />
          
          <Route path="/trainee/*" element={
            <TraineeRoute>
              <TraineeDashboard />
            </TraineeRoute>
          } />

          <Route path="/dashboard" element={
            <TraineeRoute>
              <TraineeDashboard />
            </TraineeRoute>
          } />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Interno</h1>
            <nav className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">Dashboard</span>
            </nav>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

function SupervisorDashboard() {
  return (
    <PrivateLayout>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Supervisor Dashboard</h2>
      <p className="text-gray-600 dark:text-gray-400">Manage assigned trainees, create tasks, generate QR codes</p>
    </PrivateLayout>
  );
}

function CoordinatorDashboard() {
  return (
    <PrivateLayout>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Coordinator Dashboard</h2>
      <p className="text-gray-600 dark:text-gray-400">Read-only view of assigned trainees</p>
    </PrivateLayout>
  );
}

function TraineeDashboard() {
  return (
    <PrivateLayout>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">My Dashboard</h2>
      <p className="text-gray-600 dark:text-gray-400">View attendance, tasks, DTR, documents</p>
    </PrivateLayout>
  );
}

export default App;