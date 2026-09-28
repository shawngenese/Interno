import { Navigate, useLocation } from 'react-router-dom';
import { useRequireRole } from './AuthProvider';
import type { UserRole } from './AuthProvider';
import { PageLoader } from '@/shared/components/Loader';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallbackPath?: string;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles, 
  fallbackPath = '/unauthorized' 
}: ProtectedRouteProps) {
  const { authorized, loading } = useRequireRole(allowedRoles);
  const location = useLocation();

  if (loading) {
    return <PageLoader />;
  }

  if (!authorized) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute allowedRoles={['admin']}>{children}</ProtectedRoute>;
}

export function SupervisorRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute allowedRoles={['admin', 'supervisor']}>{children}</ProtectedRoute>;
}

export function CoordinatorRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute allowedRoles={['admin', 'coordinator']}>{children}</ProtectedRoute>;
}

export function TraineeRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute allowedRoles={['admin', 'trainee']}>{children}</ProtectedRoute>;
}