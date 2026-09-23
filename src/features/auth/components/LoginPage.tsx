import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required, email } from '@/shared/utils/validators';
import { FormField, FormInput } from '@/shared/components/FormField';
import { Button } from '@/shared/components/ui/Button';
import { AlertCircle } from 'lucide-react';

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
      } else if (errorMessage.includes('auth/invalid-credential') || errorMessage.includes('auth/user-not-found') || errorMessage.includes('auth/wrong-password')) {
        setError('Email or password is incorrect');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 sm:p-8">
          <div className="text-center mb-8">
            <img src="/interno-logo.jpg" alt="Interno logo" className="w-12 h-12 rounded-2xl bg-white object-contain shadow-sm mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-foreground">Interno</h1>
            <p className="text-sm text-muted-foreground mt-1">Mobile-first Trainee Management Platform</p>
          </div>

          {error && (
            <div role="alert" className="mb-6 p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField id="email" label="Email Address" error={touched.email ? errors.email : undefined}>
              <FormInput
                id="email"
                type="email"
                value={formData.email}
                onValueChange={handleChange('email')}
                onBlur={handleBlur('email')}
                error={touched.email ? errors.email : undefined}
                placeholder="name@example.com"
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
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
            </FormField>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={loading}
              >
                Sign In
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-muted-foreground border-t border-border pt-4">
            <p>Role-based access & QR attendance tracking</p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link
            to="/"
            className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
