import { LogOut } from 'lucide-react';
import { useAuth } from '../AuthProvider';

export function LogoutButton({ className = '', iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const { logout, user, loading } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  if (!user) return null;

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      aria-label={iconOnly ? 'Sign Out' : undefined}
      title={iconOnly ? 'Sign Out' : undefined}
      className={`
        ${iconOnly ? 'w-11 h-11 p-0 justify-center' : 'px-4 py-2 min-h-[44px]'}
        text-sm font-medium text-foreground
        bg-card border border-input
        rounded-lg hover:bg-muted
        focus:outline-none focus:ring-2 focus:ring-ring
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors inline-flex items-center ${className}
      `}
    >
      {iconOnly ? (
        <LogOut className="w-5 h-5" aria-hidden="true" />
      ) : (
        loading ? 'Signing out...' : 'Sign Out'
      )}
    </button>
  );
}