import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#121212] flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-[#121212] dark:text-white">404</h1>
        <p className="mt-4 text-lg text-[#555555] dark:text-[#9E9E9E]">
          The page you're looking for doesn't exist.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
