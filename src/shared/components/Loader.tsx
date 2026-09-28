interface PageLoaderProps {
  /** Screen-reader announcement for the loader. */
  label?: string;
}

/**
 * Full-screen branded loader (arc spinner + breathing halo + wordmark).
 * Replaces the bare `animate-spin rounded-full border-t-transparent` circles.
 */
export function PageLoader({ label = 'Loading Interno' }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="min-h-[100dvh] flex flex-col items-center justify-center gap-3.5 bg-background"
    >
      <div className="loader-stack">
        <span className="loader-halo" aria-hidden="true" />
        <svg className="loader-spinner" viewBox="0 0 46 46" aria-hidden="true">
          <circle className="track" cx="23" cy="23" r="18" />
          <circle className="arc" cx="23" cy="23" r="18" />
        </svg>
      </div>
      <span className="loader-wordmark">
        <b>Interno</b>&nbsp;loading
      </span>
    </div>
  );
}

interface InlineSpinnerProps {
  className?: string;
}

/** 16px inline arc spinner for buttons and row refresh (currentColor). */
export function InlineSpinner({ className = '' }: InlineSpinnerProps) {
  return (
    <svg className={`inline-spin ${className}`} viewBox="0 0 32 32" aria-hidden="true">
      <circle className="arc2" cx="16" cy="16" r="13" />
    </svg>
  );
}
