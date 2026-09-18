import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthProvider';

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
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] dark:bg-[#121212] px-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-8">
          <div className="mb-6">
            <svg 
              className="mx-auto h-16 w-16 text-red-500" 
              aria-hidden="true"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-[#121212] dark:text-white mb-2">
            Access Denied
          </h1>
          
          <p className="text-[#555555] dark:text-[#9E9E9E] mb-6">
            You don't have permission to access this page.
            {role && <span className="block mt-2">Your role: <strong className="capitalize">{role}</strong></span>}
          </p>

          <div className="space-y-3">
            <button
              onClick={handleGoToDashboard}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Go to Dashboard
            </button>
            
            <button
              onClick={handleLogout}
              className="w-full py-3 px-4 bg-white dark:bg-[#3A3A3A] text-[#3A3A3A] dark:text-[#BDBDBD] font-medium rounded-lg border border-[#BDBDBD] dark:border-[#555555] hover:bg-[#F5F5F5] dark:hover:bg-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Sign Out
            </button>
          </div>

          {user && (
            <p className="mt-6 text-xs text-[#757575] dark:text-[#757575]">
              Signed in as: {user.email}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}