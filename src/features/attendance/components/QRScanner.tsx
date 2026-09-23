import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFunctionsInstancePublic } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { formatTime12 } from '@/shared/utils/dateUtils';
import { Button } from '@/shared/components/ui/Button';
import { Camera, QrCode, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

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

      // Responsive scan box: 70% of the narrowest viewport dimension, clamped 200–300px
      const qrSize = Math.max(200, Math.min(300, Math.floor(Math.min(window.innerWidth, 480) * 0.7)));
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: qrSize, height: qrSize },
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
      setManualError('Enter a valid QR code token');
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
      <div className="bg-card rounded-xl shadow-sm border border-border p-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-warning/10 flex items-center justify-center text-warning">
          <Camera className="w-6 h-6" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-foreground">Camera Permission Required</h3>
        {isInsecureContext ? (
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Camera requires HTTPS. Access this page from <strong>localhost</strong> or ask your admin to enable HTTPS.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Please enable camera access in your browser settings to scan QR codes.
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            variant="primary"
            onClick={startScanning}
          >
            Retry Camera
          </Button>
          <Button
            variant="secondary"
            onClick={() => setManualMode(true)}
          >
            Enter Code Manually
          </Button>
        </div>
      </div>
    );
  }

  if (manualMode) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Manual Code Entry</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter the QR code token shown on the supervisor's screen.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setManualMode(false);
              setManualToken('');
              setManualError(null);
            }}
          >
            <Camera className="w-4 h-4 mr-1.5" /> Use Camera
          </Button>
        </div>

        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <label htmlFor="manual-token" className="block text-xs font-semibold text-foreground mb-1.5">
              QR Token
            </label>
            <input
              type="text"
              id="manual-token"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste or type the QR code token..."
              className="w-full h-11 px-4 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
            />
          </div>

          {manualError && (
            <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{manualError}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            isLoading={submitting}
            disabled={!manualToken.trim()}
            className="w-full h-11"
          >
            Submit
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">QR Attendance Scanner</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Point camera at supervisor's QR code. Scans {scanning ? 'active' : 'stopped'}.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              stopScanning();
              setManualMode(true);
            }}
          >
            <KeyRound className="w-4 h-4 mr-1.5" /> Enter Code
          </Button>
        </div>
      </div>

      <div className="relative aspect-square max-w-xs mx-auto p-4 flex items-center justify-center">
        <style>{`#qr-reader { border: none !important; padding: 0 !important; margin: 0 !important; width: 100% !important; border-radius: 0.75rem; overflow: hidden; } #qr-reader video { width: 100% !important; height: 100% !important; object-fit: cover !important; border-radius: 0.75rem; } #qr-reader__scan_region { min-height: 0 !important; } #qr-reader img[alt="Info icon"] { display: none !important; } #qr-reader__dashboard { display: none !important; }`}</style>
        <div id="qr-reader" aria-label="QR code scanner camera view" className="w-full h-full rounded-xl" ref={videoRef as React.RefObject<HTMLDivElement>} />
        {scanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
            <div className="relative w-60 h-60 border-2 border-primary/40 rounded-2xl flex items-center justify-center">
              {/* Corner accents */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
              
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-on-primary text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
                Align QR code
              </div>
              <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-card border border-border text-foreground text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-sm animate-pulse">
                Scanning...
              </div>
            </div>
          </div>
        )}
      </div>

      {lastScan && (
        <div className="p-4 border-t border-border bg-success/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              <div>
                <p className="text-sm font-bold text-success">
                  {lastScan.action === 'time_in' ? 'Time In' : 'Time Out'} Recorded
                </p>
                <p className="text-xs text-success/80">
                  {formatTime12(lastScan.timestamp)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

