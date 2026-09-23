import { useEffect, useState, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFunctionsInstancePublic, getFirestoreInstancePublic } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { formatTime12 } from '@/shared/utils/dateUtils';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { RefreshCw, CheckCircle2, QrCode, Clock, ShieldCheck, UserCheck } from 'lucide-react';

interface SupervisorQRDisplayProps {
  action: 'time_in' | 'time_out';
  expirationSeconds?: 30 | 60 | 120 | 300;
  isActive?: boolean;
  onGenerated?: (data: { token: string; expiresAt: number; sessionId: string }) => void;
}

interface ScanNotification {
  id: string;
  traineeId: string;
  type: 'time_in' | 'time_out';
  timestamp: number;
  deviceInfo?: Record<string, unknown>;
}

export function SupervisorQRDisplay({
  action,
  expirationSeconds = 60,
  isActive = false,
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
  const [scans, setScans] = useState<ScanNotification[]>([]);
  const countdownRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const generatingRef = useRef(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  const generateQRRef = useRef<((isRetry?: boolean) => Promise<void>) | null>(null);

  const generateQR = useCallback(
    async (isRetry = false) => {
      if (!user?.uid) return;
      if (generatingRef.current && !isRetry) return;
      generatingRef.current = true;
      setLoading(true);
      setError(null);
      setScans([]);

      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      try {
        const functions = getFunctionsInstancePublic();
        const generateQRToken = httpsCallable<
          { action: string; expirationSeconds: number },
          {
            token: string;
            qrDataUrl: string;
            expiresAt: number;
            sessionId: string;
          }
        >(functions, 'generateQRToken');

        const result = await generateQRToken({ action, expirationSeconds });
        const data = result.data;

        setToken(data.token);
        setQrDataUrl(data.qrDataUrl);
        setExpiresAt(data.expiresAt);
        setSessionId(data.sessionId);
        retryCountRef.current = 0;
        onGenerated?.({ token: data.token, expiresAt: data.expiresAt, sessionId: data.sessionId });

        const db = getFirestoreInstancePublic();
        const scansQuery = query(
          collection(db, 'attendance_records'),
          where('qrSessionId', '==', data.sessionId),
          orderBy('timestamp', 'desc'),
          limit(10),
        );

        const unsubscribe = onSnapshot(scansQuery, (snapshot) => {
          const newScans: ScanNotification[] = [];
          snapshot.forEach((doc) => {
            const docData = doc.data();
            newScans.push({
              id: doc.id,
              traineeId: docData.traineeId,
              type: docData.type,
              timestamp: docData.timestamp,
              deviceInfo: docData.deviceInfo,
            });
          });
          setScans(newScans);
        });

        unsubscribeRef.current = unsubscribe;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate QR';
        if (!isRetry && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          const delay = Math.min(1000 * 2 ** (retryCountRef.current - 1), 8000);
          setTimeout(() => generateQRRef.current?.(true), delay);
          return;
        }
        setError(message);
        retryCountRef.current = 0;
      } finally {
        setLoading(false);
        generatingRef.current = false;
      }
    },
    [user?.uid, action, expirationSeconds, onGenerated],
  );

  useEffect(() => {
    generateQRRef.current = generateQR;
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
      if (countdownRef.current) cancelAnimationFrame(countdownRef.current);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdownRef.current) cancelAnimationFrame(countdownRef.current);

    if (!expiresAt) {
      setTimeLeft(expirationSeconds);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining > 0) {
        countdownRef.current = requestAnimationFrame(tick);
      }
    };

    countdownRef.current = requestAnimationFrame(tick);
    return () => {
      if (countdownRef.current) cancelAnimationFrame(countdownRef.current);
    };
  }, [expiresAt, expirationSeconds]);

  // Auto-refresh 10 seconds before expiry
  useEffect(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (isActive && expiresAt) {
      const msUntilRefresh = Math.max(0, expiresAt - Date.now() - 10_000);
      if (msUntilRefresh > 0) {
        refreshTimerRef.current = setTimeout(() => {
          generateQRRef.current?.();
        }, msUntilRefresh);
      }
    }
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [isActive, expiresAt]);

  // Handle active toggle
  useEffect(() => {
    if (isActive && user?.uid) {
      generateQRRef.current?.();
    }
    if (!isActive) {
      if (countdownRef.current) cancelAnimationFrame(countdownRef.current);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setToken(null);
      setQrDataUrl(null);
      setExpiresAt(null);
      setSessionId(null);
      setScans([]);
      setError(null);
      setTimeLeft(expirationSeconds);
    }
  }, [isActive, user?.uid, expirationSeconds]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const actionLabel = action === 'time_in' ? 'Time In' : 'Time Out';

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground text-base">{actionLabel} Display View</h3>
        </div>
        <span
          className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
            action === 'time_in'
              ? 'bg-success/15 text-success'
              : 'bg-destructive/15 text-destructive'
          }`}
        >
          {actionLabel}
        </span>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col items-center gap-5">
        {!isActive && !token && (
          <div className="py-12 text-center max-w-sm space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <QrCode className="w-6 h-6" />
            </div>
            <h4 className="font-medium text-foreground">QR Scanner Inactive</h4>
            <p className="text-xs text-muted-foreground">
              Click &quot;Start QR&quot; above to start generating encrypted, rotating QR codes for trainees.
            </p>
          </div>
        )}

        {loading && (
          <div className="py-12 flex flex-col items-center gap-3">
            <Skeleton variant="rectangular" width={256} height={256} className="rounded-2xl" />
            <Skeleton variant="text" width={160} height={18} />
          </div>
        )}

        {token && qrDataUrl && !loading && (
          <>
            {/* Viewfinder Wrapper with Corner Accents */}
            <div className="relative p-4 bg-background border-2 border-primary/40 rounded-2xl shadow-md">
              {/* Top-Left Corner Accent */}
              <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-primary" />
              {/* Top-Right Corner Accent */}
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-primary" />
              {/* Bottom-Left Corner Accent */}
              <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-primary" />
              {/* Bottom-Right Corner Accent */}
              <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-primary" />

              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG
                  value={token}
                  size={240}
                  level="M"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>

              <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs font-medium px-3 py-0.5 rounded-full shadow whitespace-nowrap flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-primary animate-spin" />
                <span>Expires in {formatTime(timeLeft)}</span>
              </div>
            </div>

            {/* Countdown Progress Bar */}
            <div className="w-full max-w-sm space-y-1.5 text-center pt-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ease-linear ${
                    action === 'time_in' ? 'bg-success' : 'bg-destructive'
                  }`}
                  style={{ width: `${Math.max(0, (timeLeft / expirationSeconds) * 100)}%` }}
                />
              </div>
              <p className="text-xs font-mono text-muted-foreground">
                {formatTime(timeLeft)} remaining until next rotation
              </p>
            </div>

            {/* Session Metadata */}
            <div className="w-full max-w-sm flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
              <span>Session: <code className="font-mono text-foreground">{sessionId?.slice(0, 8)}...</code></span>
              <span>Expires at: {expiresAt ? formatTime12(expiresAt) : '—'}</span>
            </div>

            {isActive && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => generateQR()}
                isLoading={loading}
                className="gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh QR Now
              </Button>
            )}
          </>
        )}
      </div>

      {/* Real-time scan notifications feed */}
      {token && (
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              Live Scan Activity
            </h4>
            {scans.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-success/15 text-success rounded-full">
                {scans.length} {scans.length === 1 ? 'scan' : 'scans'}
              </span>
            )}
          </div>

          {scans.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4 bg-muted/20 rounded-xl border border-dashed border-border">
              Waiting for trainees to scan...
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {scans.map((scan) => (
                <div
                  key={scan.id}
                  className="flex items-center justify-between p-3 bg-success/5 border border-success/20 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {scan.type === 'time_in' ? 'Time In Recorded' : 'Time Out Recorded'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Trainee ID: {scan.traineeId.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatTime12(scan.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
