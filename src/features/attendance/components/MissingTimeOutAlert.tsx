import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatTime12 } from '@/shared/utils/dateUtils';
import { AlertTriangle, X } from 'lucide-react';
import type { AttendanceRecord } from '../types';

export function MissingTimeOutAlert() {
  const { user } = useAuth();
  const [showAlert, setShowAlert] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [timeInTime, setTimeInTime] = useState<string | null>(null);

  const checkMissingTimeOut = useCallback(async () => {
    if (!user?.uid) return;

    const hour = new Date().getHours();
    if (hour < 7 || hour >= 19) return;

    try {
      const db = getFirestoreInstancePublic();

      const traineeSnap = await getDocs(
        query(collection(db, 'trainees'), where('userId', '==', user.uid), where('status', '==', 'active'))
      );
      if (traineeSnap.empty) return;

      const traineeId = traineeSnap.docs[0].id;

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const end = start + 24 * 60 * 60 * 1000 - 1;

      const snap = await getDocs(
        query(
          collection(db, 'attendance_records'),
          where('traineeId', '==', traineeId),
          where('timestamp', '>=', start),
          where('timestamp', '<=', end),
        )
      );

      const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));

      const hasTimeIn = records.some((r) => r.type === 'time_in');
      const hasTimeOut = records.some((r) => r.type === 'time_out');

      if (hasTimeIn && hasTimeOut) {
        setTimedOut(true);
        setShowAlert(false);
        return;
      }

      if (hasTimeIn && !hasTimeOut) {
        const timeInRecord = records.find((r) => r.type === 'time_in');
        if (timeInRecord) {
          setTimeInTime(formatTime12(timeInRecord.timestamp));
          setShowAlert(true);
        }
      }
    } catch (err) {
      console.error('Failed to check missing time-out:', err);
    }
  }, [user]);

  useEffect(() => {
    if (timedOut) return;
    checkMissingTimeOut();
    const interval = setInterval(checkMissingTimeOut, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkMissingTimeOut, timedOut]);

  if (!showAlert) return null;

  return (
    <div role="alert" className="bg-warning/10 border border-warning/20 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-warning mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-warning">
            Don't forget to time out!
          </p>
          <p className="mt-0.5 text-xs text-warning/90">
            You timed in at {timeInTime}. Please scan a time-out QR code before leaving to complete your attendance record.
          </p>
        </div>
        <button
          onClick={() => setShowAlert(false)}
          className="shrink-0 text-warning/70 hover:text-warning p-1 rounded-md transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

