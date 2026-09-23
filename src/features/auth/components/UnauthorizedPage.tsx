import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { Button } from '@/shared/components/ui/Button';
import { ShieldAlert } from 'lucide-react';

export function UnauthorizedPage() {
  const { role, user, logout } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md text-center">
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 sm:p-8">
          <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-destructive">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            Access Denied
          </h1>

          <p className="text-sm text-muted-foreground mb-6">
            You don't have permission to access this page or resource.
            {role && <span className="block mt-2 font-medium text-foreground">Your active role: <strong className="capitalize">{role}</strong></span>}
          </p>

          <div className="space-y-3">
            <Button
              onClick={handleGoToDashboard}
              variant="primary"
              size="lg"
              className="w-full"
            >
              Go to Dashboard
            </Button>

            <Button
              onClick={handleLogout}
              variant="secondary"
              size="lg"
              className="w-full"
            >
              Sign Out
            </Button>
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