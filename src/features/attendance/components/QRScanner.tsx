import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '@/features/auth/AuthProvider';
import { callEdgeFunction, isSupabaseConfigured } from '@/config/supabase';

interface QRScannerProps {
  onScanResult?: (result: { action: 'time_in' | 'time_out'; timestamp: number; message: string }) => void;
  onError?: (error: string) => void;
}

export function QRScanner({ onScanResult, onError }: QRScannerProps) {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [lastScan, setLastScan] = useState<{ action: string; timestamp: number; message: string } | null>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);

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
          await stopScanning();

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
                token: decodedText,
                deviceInfo: {
                  platform: navigator.platform,
                  userAgent: navigator.userAgent,
                  screenWidth: window.screen.width,
                  screenHeight: window.screen.height,
                },
              },
              { idToken }
            );

            setLastScan({ action: result.action, timestamp: result.timestamp, message: result.message });
            onScanResult?.({ action: result.action, timestamp: result.timestamp, message: result.message });

            setTimeout(() => startScanningRef.current?.(), 3000);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Scan failed';
            onError?.(message);
            setTimeout(() => startScanningRef.current?.(), 2000);
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
  }, [scanning, onScanResult, onError, stopScanning]);

  // Store reference for recursive calls from timeouts
  useEffect(() => {
    startScanningRef.current = startScanning;
  }, [startScanning]);

  useEffect(() => {
    if (user?.uid) {
      startScanning();
    }
    return () => {
      stopScanning();
    };
  }, [user?.uid, startScanning, stopScanning]);

  if (permissionDenied) {
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
        <button
          onClick={startScanning}
          className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">QR Attendance Scanner</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Point camera at supervisor's QR code. Scans {scanning ? 'active' : 'stopped'}.
        </p>
      </div>

      <div className="relative aspect-square max-w-xs mx-auto bg-gray-100 dark:bg-gray-900">
        <div id="qr-reader" className="w-full h-full" ref={videoRef as React.RefObject<HTMLDivElement>} />
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
                {new Date(lastScan.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <span className="text-2xl">✓</span>
          </div>
        </div>
      )}
    </div>
  );
}