import { useState, useEffect, useCallback } from 'react';
import { QRScanner } from './QRScanner';
import { AttendanceHistoryCalendar } from './AttendanceHistoryCalendar';
import { MissingTimeOutAlert } from './MissingTimeOutAlert';
import { getTodayAttendance } from '../services/attendanceService';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatTime12, formatDateTime12 } from '@/shared/utils/dateUtils';
import { Skeleton } from '@/shared/components/Skeleton';
import { LogIn, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import type { TodayAttendanceStatus } from '../types';

export function TraineeAttendance() {
  const { user } = useAuth();
  const [todayStatus, setTodayStatus] = useState<TodayAttendanceStatus>({
    hasTimeIn: false,
    hasTimeOut: false,
  });
  const [loading, setLoading] = useState(true);
  const [lastAction, setLastAction] = useState<{ action: string; timestamp: number; message: string } | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const { getFirestoreInstancePublic } = await import('@/config/firebase');
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const db = getFirestoreInstancePublic();

      const traineeSnap = await getDocs(
        query(collection(db, 'trainees'), where('userId', '==', user!.uid), where('status', '==', 'active'))
      );
      if (traineeSnap.empty) return;

      const traineeId = traineeSnap.docs[0].id;
      const status = await getTodayAttendance(traineeId);
      setTodayStatus(status);
    } catch (err) {
      console.error('Failed to load attendance status:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!lastAction) return;
    const t = setTimeout(() => setLastAction(null), 5000);
    return () => clearTimeout(t);
  }, [lastAction]);

  useEffect(() => {
    if (!lastError) return;
    const t = setTimeout(() => setLastError(null), 5000);
    return () => clearTimeout(t);
  }, [lastError]);

  const handleScanResult = (result: { action: string; timestamp: number; message: string }) => {
    setLastAction(result);
    setLastError(null);
    refreshStatus();
  };

  const handleError = (error: string) => {
    console.error('Scan error:', error);
    setLastError(error);
  };

  const timeInLabel = todayStatus.timeInRecord
    ? `Timed in at ${formatTime12(todayStatus.timeInRecord.timestamp)}`
    : 'Not timed in yet';

  const timeOutLabel = todayStatus.timeOutRecord
    ? `Timed out at ${formatTime12(todayStatus.timeOutRecord.timestamp)}`
    : 'Not timed out yet';

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-card rounded-xl shadow-sm border border-border p-6 space-y-4">
          <Skeleton variant="text" width="40%" height={24} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton variant="rectangular" height={80} className="rounded-xl" />
            <Skeleton variant="rectangular" height={80} className="rounded-xl" />
          </div>
        </div>
        <Skeleton variant="rectangular" height={320} className="rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MissingTimeOutAlert />

      <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
        <h2 className="text-lg font-bold text-foreground mb-4">Today's Attendance</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`p-4 rounded-xl border transition-colors ${
            todayStatus.hasTimeIn
              ? 'border-success/30 bg-success/10'
              : 'border-border bg-muted/30'
          }`}>
            <div className="flex items-center gap-2 mb-1.5">
              <LogIn className={`w-4 h-4 ${todayStatus.hasTimeIn ? 'text-success' : 'text-muted-foreground'}`} />
              <h3 className="font-semibold text-sm text-foreground">Time In</h3>
            </div>
            <p className="text-xs text-muted-foreground">{timeInLabel}</p>
          </div>

          <div className={`p-4 rounded-xl border transition-colors ${
            todayStatus.hasTimeOut
              ? 'border-primary/30 bg-primary/10'
              : 'border-border bg-muted/30'
          }`}>
            <div className="flex items-center gap-2 mb-1.5">
              <LogOut className={`w-4 h-4 ${todayStatus.hasTimeOut ? 'text-primary' : 'text-muted-foreground'}`} />
              <h3 className="font-semibold text-sm text-foreground">Time Out</h3>
            </div>
            <p className="text-xs text-muted-foreground">{timeOutLabel}</p>
          </div>
        </div>
      </div>

      {lastAction && (
        <div role="status" className="bg-success/10 border border-success/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            <div>
              <p className="font-bold text-sm text-success">
                {lastAction.action === 'time_in' ? 'Time In' : 'Time Out'} Recorded
              </p>
              <p className="text-xs text-success/80">
                {formatDateTime12(lastAction.timestamp)}
              </p>
            </div>
          </div>
        </div>
      )}

      {lastError && (
        <div role="alert" className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
          <p className="text-sm font-medium text-destructive">{lastError}</p>
        </div>
      )}

      <QRScanner onScanResult={handleScanResult} onError={handleError} />

      <AttendanceHistoryCalendar />
    </div>
  );
}

