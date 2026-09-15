import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';

const ROLE_DASHBOARD: Record<string, string> = {
  admin: '/admin',
  supervisor: '/supervisor',
  coordinator: '/coordinator',
  trainee: '/trainee',
};

export function DashboardRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const target = ROLE_DASHBOARD[role || 'trainee'] || '/trainee';

  return <Navigate to={target} replace />;
}
