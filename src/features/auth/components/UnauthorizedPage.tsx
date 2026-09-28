import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { Button } from '@/shared/components/ui/Button';
import { ShieldAlert } from 'lucide-react';

export function UnauthorizedPage() {
  const { role, user, logout, refreshRole } = useAuth();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const handleGoToDashboard = () => {
    if (role === 'admin') navigate('/admin');
    else if (role === 'supervisor') navigate('/supervisor');
    else if (role === 'coordinator') navigate('/coordinator');
    else if (role === 'trainee') navigate('/trainee');
    else navigate('/login');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleRefreshRole = async () => {
    setRefreshing(true);
    try {
      await refreshRole();
    } finally {
      setRefreshing(false);
    }
  };

  const title = !user ? 'Sign In Required' : role ? 'Access Denied' : 'No Role Assigned';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md text-center">
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 sm:p-8">
          <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-destructive">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            {title}
          </h1>

          <p className="text-sm text-muted-foreground mb-6">
            {!user
              ? 'You need to sign in to access this page or resource.'
              : role
                ? "You don't have permission to access this page or resource."
                : 'Your account has no assigned role, so no area of the app is available to it yet.'}
            {role && (
              <span className="block mt-2 font-medium text-foreground">
                Your active role: <strong className="capitalize">{role}</strong>
              </span>
            )}
            {!role && user && (
              <span className="block mt-2 font-medium text-foreground">
                Ask an administrator to assign you a role, then refresh below.
              </span>
            )}
          </p>

          <div className="space-y-3">
            {!user && (
              <Button
                onClick={() => navigate('/login')}
                variant="primary"
                size="lg"
                className="w-full"
              >
                Go to Sign In
              </Button>
            )}

            {user && role && (
              <Button
                onClick={handleGoToDashboard}
                variant="primary"
                size="lg"
                className="w-full"
              >
                Go to Dashboard
              </Button>
            )}

            {user && !role && (
              <Button
                onClick={handleRefreshRole}
                variant="primary"
                size="lg"
                className="w-full"
                disabled={refreshing}
              >
                {refreshing ? 'Checking for a role...' : 'Refresh Role'}
              </Button>
            )}

            {user && (
              <Button
                onClick={handleLogout}
                variant="secondary"
                size="lg"
                className="w-full"
              >
                Sign Out
              </Button>
            )}
          </div>

          {user && (
            <p className="mt-6 text-xs text-muted-foreground border-t border-border pt-4">
              Signed in as: {user.email}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
