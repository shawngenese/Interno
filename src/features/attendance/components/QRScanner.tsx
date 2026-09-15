import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '@/features/auth/AuthProvider';
import { callEdgeFunction, isSupabaseConfigured } from '@/config/supabase';
import { formatTime12 } from '@/shared/utils/dateUtils';

interface QRScannerProps {
  onScanResult?: (result: { action: 'time_in' | 'time_out'; timestamp: number; message: string }) => void;
  onError?: (error: string) => void;
}

/** Parse JWT payload without verification (for offline expiry check only). */
function parseJWT(token: string): { exp?: number; action?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { exp: payload.exp, action: payload.action };
  } catch {
    return null;
  }
}

/** Trigger haptic feedback if available. */
function hapticFeedback(type: 'success' | 'error' | 'warning') {
  if (!navigator.vibrate) return;
  switch (type) {
    case 'success':
      navigator.vibrate([50, 30, 50]);
      break;
    case 'error':
      navigator.vibrate([100, 50, 100, 50, 100]);
      break;
    case 'warning':
      navigator.vibrate(100);
      break;
  }
}

export function QRScanner({ onScanResult, onError }: QRScannerProps) {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [lastScan, setLastScan] = useState<{ action: string; timestamp: number; message: string } | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef(false);

  const startScanningRef = useRef<() => Promise<void>>();

  const stopScanning = useCallback(async () => {
    if (html5QrcodeRef.current) {
      try {
        await html5QrcodeRef.current.stop();
      } catch {
        // ignore
      }
      html5QrcodeRef.current = null;
    }
    setScanning(false);
  }, []);

  const processToken = useCallback(async (token: string) => {
    await stopScanning();

    // Offline check: parse JWT and verify expiry before calling Edge
    const payload = parseJWT(token);
    if (payload?.exp) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp < nowSeconds) {
        hapticFeedback('error');
        const msg = 'QR code has expired. Ask supervisor for a new one.';
        setManualError(msg);
        onError?.(msg);
        setTimeout(() => startScanningRef.current?.(), 2000);
        return;
      }
    }

    try {
      const auth = (await import('@/config/firebase')).getAuthInstancePublic();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');

      const idToken = await currentUser.getIdToken(true);
      const result = await callEdgeFunction<{
        success: boolean;
        action: 'time_in' | 'time_out';
        timestamp: number;
        attendanceId: string;
        message: string;
      }>(
        'validate_qr_scan',
        {
          token,
          deviceInfo: {
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
          },
        },
        { idToken }
      );

      hapticFeedback('success');
      setLastScan({ action: result.action, timestamp: result.timestamp, message: result.message });
      setManualError(null);
      onScanResult?.({ action: result.action, timestamp: result.timestamp, message: result.message });

      setTimeout(() => startScanningRef.current?.(), 3000);
    } catch (err) {
      hapticFeedback('error');
      const message = err instanceof Error ? err.message : 'Scan failed';
      setManualError(message);
      onError?.(message);
      setTimeout(() => startScanningRef.current?.(), 2000);
    }
  }, [stopScanning, onScanResult, onError]);

  const startScanning = useCallback(async () => {
    if (!videoRef.current || scanning) return;

    if (!isSupabaseConfigured()) {
      onError?.('Supabase not configured. Attendance scanning unavailable.');
      return;
    }

    setPermissionDenied(false);
    try {
      const scanner = new Html5Qrcode('qr-reader');
      html5QrcodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText: string) => {
          if (processingRef.current) return;
          processingRef.current = true;
          try {
            await processToken(decodedText);
          } finally {
            processingRef.current = false;
          }
        },
        () => {
          // Ignore scan errors
        }
      );

      setScanning(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start scanner';
      if (message.includes('permission') || message.includes('Permission')) {
        setPermissionDenied(true);
      }
      onError?.(message);
    }
  }, [scanning, processToken, onError]);

  // Store reference for recursive calls from timeouts
  useEffect(() => {
    startScanningRef.current = startScanning;
  }, [startScanning]);

  useEffect(() => {
    if (user?.uid && !manualMode) {
      startScanning();
    }
    return () => {
      stopScanning();
    };
  }, [user?.uid, startScanning, stopScanning, manualMode]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    if (!manualToken.trim()) {
      setManualError('Please enter a QR code token');
      return;
    }
    setSubmitting(true);
    await processToken(manualToken.trim());
    setSubmitting(false);
    setManualToken('');
  };

  if (permissionDenied && !manualMode) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">Camera Permission Required</h3>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Please enable camera access in your browser settings to scan QR codes.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            onClick={startScanning}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Retry Camera
          </button>
          <button
            onClick={() => setManualMode(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Enter Code Manually
          </button>
        </div>
      </div>
    );
  }

  if (manualMode) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Manual Code Entry</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Enter the QR code token shown on the supervisor's screen.
            </p>
          </div>
          <button
            onClick={() => {
              setManualMode(false);
              setManualToken('');
              setManualError(null);
            }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            Use Camera
          </button>
        </div>

        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <label htmlFor="manual-token" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              QR Token
            </label>
            <input
              type="text"
              id="manual-token"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste or type the QR code token..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              autoFocus
            />
          </div>

          {manualError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {manualError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !manualToken.trim()}
            className="w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Validating...' : 'Submit'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">QR Attendance Scanner</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Point camera at supervisor's QR code. Scans {scanning ? 'active' : 'stopped'}.
            </p>
          </div>
          <button
            onClick={() => {
              stopScanning();
              setManualMode(true);
            }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            Enter Code
          </button>
        </div>
      </div>

      <div className="relative aspect-square max-w-xs mx-auto bg-gray-100 dark:bg-gray-900">
        <div id="qr-reader" aria-label="QR code scanner camera view" className="w-full h-full" ref={videoRef as React.RefObject<HTMLDivElement>} />
        {scanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-64 h-64">
              <div className="absolute inset-0 border-4 border-blue-500 rounded-lg" />
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                Align QR code within frame
              </div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                Scanning...
              </div>
            </div>
          </div>
        )}
      </div>

      {lastScan && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                {lastScan.action === 'time_in' ? 'Time In' : 'Time Out'} Recorded
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                {formatTime12(lastScan.timestamp)}
              </p>
            </div>
            <span className="text-2xl">&#10003;</span>
          </div>
        </div>
      )}
    </div>
  );
}
