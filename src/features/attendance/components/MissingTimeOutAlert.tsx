import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatTime12 } from '@/shared/utils/dateUtils';
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
  }, [user?.uid]);

  useEffect(() => {
    if (timedOut) return;
    checkMissingTimeOut();
    const interval = setInterval(checkMissingTimeOut, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkMissingTimeOut, timedOut]);

  if (!showAlert) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Don't forget to time out!
          </p>
          <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
            You timed in at {timeInTime}. Please scan a time-out QR code before leaving to complete your attendance record.
          </p>
        </div>
        <button
          onClick={() => setShowAlert(false)}
          className="flex-shrink-0 text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300"
          aria-label="Dismiss alert"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
