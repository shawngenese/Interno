import { useAuth } from '../AuthProvider';

export function LogoutButton({ className = '' }: { className?: string }) {
  const { logout, user, loading } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  if (!user) return null;

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={`
        px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
        bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
        rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700
        focus:outline-none focus:ring-2 focus:ring-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors ${className}
      `}
    >
      {loading ? 'Signing out...' : 'Sign Out'}
    </button>
  );
}