import { useState, useEffect, useCallback } from 'react';
import { QRScanner } from './QRScanner';
import { AttendanceHistoryCalendar } from './AttendanceHistoryCalendar';
import { MissingTimeOutAlert } from './MissingTimeOutAlert';
import { getTodayAttendance } from '../services/attendanceService';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatTime12, formatDateTime12 } from '@/shared/utils/dateUtils';
import type { TodayAttendanceStatus } from '../types';

export function TraineeAttendance() {
  const { user } = useAuth();
  const [todayStatus, setTodayStatus] = useState<TodayAttendanceStatus>({
    hasTimeIn: false,
    hasTimeOut: false,
  });
  const [loading, setLoading] = useState(true);
  const [lastAction, setLastAction] = useState<{ action: string; timestamp: number; message: string } | null>(null);

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

  const handleScanResult = (result: { action: string; timestamp: number; message: string }) => {
    setLastAction(result);
    refreshStatus();
  };

  const handleError = (error: string) => {
    console.error('Scan error:', error);
  };

  const timeInLabel = todayStatus.timeInRecord
    ? `Timed in at ${formatTime12(todayStatus.timeInRecord.timestamp)}`
    : 'Not timed in yet';

  const timeOutLabel = todayStatus.timeOutRecord
    ? `Timed out at ${formatTime12(todayStatus.timeOutRecord.timestamp)}`
    : 'Not timed out yet';

  return (
    <div className="space-y-4">
      <MissingTimeOutAlert />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Today's Attendance</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`p-4 rounded-lg border ${todayStatus.hasTimeIn ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${todayStatus.hasTimeIn ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <h3 className="font-medium text-gray-900 dark:text-white">Time In</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{timeInLabel}</p>
          </div>

          <div className={`p-4 rounded-lg border ${todayStatus.hasTimeOut ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${todayStatus.hasTimeOut ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <h3 className="font-medium text-gray-900 dark:text-white">Time Out</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{timeOutLabel}</p>
          </div>
        </div>
      </div>

      {lastAction && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">
                {lastAction.action === 'time_in' ? '✓ Time In' : '✓ Time Out'} Recorded
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                {formatDateTime12(lastAction.timestamp)}
              </p>
            </div>
          </div>
        </div>
      )}

      <QRScanner onScanResult={handleScanResult} onError={handleError} />

      <AttendanceHistoryCalendar />

      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
            <svg className="animate-spin mx-auto h-8 w-8 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading attendance...</p>
          </div>
        </div>
      )}
    </div>
  );
}
