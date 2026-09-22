import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required, email } from '@/shared/utils/validators';
import { FormField, FormInput } from '@/shared/components/FormField';

export function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { formData, errors, touched, handleChange, handleBlur, handleSubmit } = useFormValidation(
    { email: '', password: '' },
    {
      email: [required('Email is required'), email()],
      password: [required('Password is required')],
    },
  );

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard';

  const onSubmit = async (data: { email: string; password: string }) => {
    setError('');
    setLoading(true);

    try {
      await login(data.email, data.password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      if (errorMessage.includes('auth/user-not-found')) {
        setError('No account found with this email');
      } else if (errorMessage.includes('auth/wrong-password')) {
        setError('Incorrect password');
      } else if (errorMessage.includes('auth/invalid-email')) {
        setError('Invalid email address');
      } else if (errorMessage.includes('auth/too-many-requests')) {
        setError('Too many attempts. Please try again later');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] dark:bg-[#121212] px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#121212] dark:text-white">Interno</h1>
            <p className="text-[#555555] dark:text-[#9E9E9E] mt-1">Trainee Management System</p>
          </div>

          {error && (
            <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField id="email" label="Email" error={touched.email ? errors.email : undefined}>
              <FormInput
                id="email"
                type="email"
                value={formData.email}
                onValueChange={handleChange('email')}
                onBlur={handleBlur('email')}
                error={touched.email ? errors.email : undefined}
                placeholder="Enter your email"
                autoComplete="email"
                disabled={loading}
              />
            </FormField>

            <FormField id="password" label="Password" error={touched.password ? errors.password : undefined}>
              <FormInput
                id="password"
                type="password"
                value={formData.password}
                onValueChange={handleChange('password')}
                onBlur={handleBlur('password')}
                error={touched.password ? errors.password : undefined}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
              />
            </FormField>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[#555555] dark:text-[#9E9E9E]">
            <p>Mobile-first OJT Management Platform</p>
          </div>
        </div>
      </div>
    </div>
  );
}
