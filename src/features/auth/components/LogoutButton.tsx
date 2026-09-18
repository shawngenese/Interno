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
        px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD]
        bg-white dark:bg-[#1E1E1E] border border-[#BDBDBD] dark:border-[#555555]
        rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]
        focus:outline-none focus:ring-2 focus:ring-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors ${className}
      `}
    >
      {loading ? 'Signing out...' : 'Sign Out'}
    </button>
  );
}