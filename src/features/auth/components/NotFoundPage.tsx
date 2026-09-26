import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { FileQuestion } from 'lucide-react';

interface NotFoundPageProps {
  /**
   * 'screen' (default) fills the viewport — use for standalone routes.
   * 'content' sizes to a shorter block — use when rendered inside a layout shell,
   * otherwise min-h-screen on top of the shell's own min-h-screen causes scrolling.
   */
  height?: 'screen' | 'content';
}

export function NotFoundPage({ height = 'screen' }: NotFoundPageProps) {
  const navigate = useNavigate();

  return (
    <div
      className={`${height === 'screen' ? 'min-h-screen' : 'min-h-[60vh]'} bg-background flex items-center justify-center px-4 py-8`}
    >
      <div className="text-center max-w-md w-full bg-card rounded-2xl shadow-sm border border-border p-6 sm:p-8">
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4 text-muted-foreground">
          <FileQuestion className="w-8 h-8" />
        </div>
        <h1 className="text-5xl font-extrabold text-foreground tracking-tight">404</h1>
        <p className="mt-2 text-base font-semibold text-foreground">
          Page Not Found
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="mt-6">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="primary"
            size="lg"
            className="w-full"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
