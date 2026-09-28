import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { PageLoader } from '@/shared/components/Loader';

const ROLE_DASHBOARD: Record<string, string> = {
  admin: '/admin',
  supervisor: '/supervisor',
  coordinator: '/coordinator',
  trainee: '/trainee',
};

export function DashboardRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const target = ROLE_DASHBOARD[role || 'trainee'] || '/trainee';

  return <Navigate to={target} replace />;
}
