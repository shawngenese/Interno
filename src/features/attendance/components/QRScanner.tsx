import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFunctionsInstancePublic } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
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
      const functions = getFunctionsInstancePublic();
      const validateQRScan = httpsCallable<{
        token: string;
        deviceInfo?: Record<string, unknown>;
        location?: { latitude: number; longitude: number; accuracy?: number };
      }, {
        success: boolean;
        action: 'time_in' | 'time_out';
        timestamp: number;
        attendanceId: string;
        message: string;
      }>(functions, 'validateQRScan');

      const result = await validateQRScan({
        token,
        deviceInfo: {
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
        },
      });

      hapticFeedback('success');
      const data = result.data;
      setLastScan({ action: data.action, timestamp: data.timestamp, message: data.message });
      setManualError(null);
      onScanResult?.({ action: data.action, timestamp: data.timestamp, message: data.message });

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
      if (!window.isSecureContext) {
        setPermissionDenied(true);
        onError?.('Camera requires HTTPS. Use localhost or ask admin to enable HTTPS.');
        return;
      }
      startScanningRef.current?.();
    }
    return () => {
      stopScanning();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, manualMode]);

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
    const isInsecureContext = !window.isSecureContext;
    return (
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6 text-center">
        <svg className="mx-auto h-12 w-12 text-[#9E9E9E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-[#121212] dark:text-white">Camera Permission Required</h3>
        {isInsecureContext ? (
          <p className="mt-2 text-[#757575] dark:text-[#9E9E9E]">
            Camera requires HTTPS. Access this page from <strong>localhost</strong> or ask your admin to enable HTTPS.
          </p>
        ) : (
          <p className="mt-2 text-[#757575] dark:text-[#9E9E9E]">
            Please enable camera access in your browser settings to scan QR codes.
          </p>
        )}
        <div className="mt-4 flex justify-center gap-3">
          <button
            onClick={startScanning}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Retry Camera
          </button>
          <button
            onClick={() => setManualMode(true)}
            className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-[#EFEFEF] dark:bg-[#3A3A3A] rounded-lg hover:bg-[#D5D5D5] dark:hover:bg-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Enter Code Manually
          </button>
        </div>
      </div>
    );
  }

  if (manualMode) {
    return (
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[#121212] dark:text-white">Manual Code Entry</h2>
            <p className="mt-1 text-sm text-[#757575] dark:text-[#9E9E9E]">
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
            <label htmlFor="manual-token" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              QR Token
            </label>
            <input
              type="text"
              id="manual-token"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste or type the QR code token..."
              className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
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
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] overflow-hidden">
      <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#121212] dark:text-white">QR Attendance Scanner</h2>
            <p className="mt-1 text-sm text-[#757575] dark:text-[#9E9E9E]">
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

      <div className="relative aspect-square max-w-xs mx-auto">
        <style>{`#qr-reader { border: none !important; padding: 0 !important; margin: 0 !important; } #qr-reader video { width: 100% !important; height: 100% !important; object-fit: cover !important; } #qr-reader__scan_region { min-height: 0 !important; } #qr-reader img[alt="Info icon"] { display: none !important; } #qr-reader__dashboard { display: none !important; }`}</style>
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
        <div className="p-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A] bg-green-50 dark:bg-green-900/20">
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
