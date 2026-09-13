import { useEffect, useState, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/features/auth/AuthProvider';
import { callEdgeFunction, isSupabaseConfigured } from '@/config/supabase';

interface SupervisorQRDisplayProps {
  action: 'time_in' | 'time_out';
  expirationSeconds?: 30 | 60 | 120 | 300;
  onGenerated?: (data: { token: string; expiresAt: number; sessionId: string }) => void;
}

export function SupervisorQRDisplay({
  action,
  expirationSeconds = 60,
  onGenerated,
}: SupervisorQRDisplayProps) {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(expirationSeconds);
  const countdownRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const generateQR = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured. QR generation unavailable.');
      }

      const auth = (await import('@/config/firebase')).getAuthInstancePublic();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');

      const idToken = await currentUser.getIdToken(true);
      const result = await callEdgeFunction<{
        token: string;
        qrDataUrl: string;
        expiresAt: number;
        sessionId: string;
      }>(
        'generate_qr_token',
        { action, expirationSeconds },
        { idToken }
      );

      setToken(result.token);
      setQrDataUrl(result.qrDataUrl);
      setExpiresAt(result.expiresAt);
      setSessionId(result.sessionId);
      setTimeLeft(expirationSeconds);
      onGenerated?.({ token: result.token, expiresAt: result.expiresAt, sessionId: result.sessionId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate QR';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, action, expirationSeconds, onGenerated]);

  // Countdown timer
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (timeLeft > 0) {
      countdownRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [timeLeft]);

  // Auto-refresh 10 seconds before expiry
  useEffect(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (expiresAt && timeLeft > 0) {
      const refreshAt = Math.max(10, timeLeft - 10) * 1000;
      refreshTimerRef.current = window.setTimeout(() => {
        generateQR();
      }, refreshAt);
    }
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [expiresAt, timeLeft, generateQR]);

  // Initial generation
  useEffect(() => {
    generateQR();
  }, [generateQR]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const actionLabel = action === 'time_in' ? 'Time In' : 'Time Out';
  const actionColor = action === 'time_in' ? 'bg-green-600' : 'bg-red-600';
  const actionColorDark = action === 'time_in' ? 'dark:bg-green-500' : 'dark:bg-red-500';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{actionLabel} QR Code</h2>
        <span className={`px-2 py-1 text-xs font-medium text-white rounded ${actionColor} ${actionColorDark}`}>
          {actionLabel}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col items-center gap-4">
        {token && qrDataUrl && (
          <div className="relative">
            <div className="bg-white p-4 rounded-lg shadow-inner border border-gray-200 dark:border-gray-700">
              <QRCodeSVG
                value={token}
                size={256}
                level="M"
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-2 py-1 rounded whitespace-nowrap">
              Expires in {formatTime(timeLeft)}
            </div>
          </div>
        )}

        <div className="w-full max-w-md text-center">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${actionColor} ${actionColorDark}`}
              style={{ width: `${Math.max(0, (timeLeft / expirationSeconds) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-sm font-mono text-gray-600 dark:text-gray-400">
            {formatTime(timeLeft)} remaining
          </p>
        </div>

        <div className="w-full max-w-md space-y-2 text-xs text-gray-500 dark:text-gray-400">
          <p>Session ID: <code className="font-mono">{sessionId?.slice(0, 8)}...</code></p>
          <p>Expires: {expiresAt ? new Date(expiresAt).toLocaleTimeString() : '—'}</p>
        </div>

        <button
          onClick={generateQR}
          disabled={loading}
          className="w-full max-w-md px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating...' : 'Refresh QR Code'}
        </button>
      </div>

      {token && (
        <details className="mt-4">
          <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer">Show token (for manual entry)</summary>
          <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs font-mono text-gray-700 dark:text-gray-300 break-all select-all">
            {token}
          </div>
        </details>
      )}
    </div>
  );
}