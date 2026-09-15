import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { formatTime12 } from '@/shared/utils/dateUtils';
import type { AttendanceRecord } from '../types';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  hasTimeIn: boolean;
  hasTimeOut: boolean;
  records: AttendanceRecord[];
}

export function AttendanceHistoryCalendar() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAttendanceForMonth = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);

    try {
      const db = getFirestoreInstancePublic();

      const traineeSnap = await getDocs(
        query(collection(db, 'trainees'), where('userId', '==', user.uid), where('status', '==', 'active'))
      );
      if (traineeSnap.empty) {
        setCalendarDays([]);
        return;
      }

      const traineeId = traineeSnap.docs[0].id;

      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);

      const snap = await getDocs(
        query(
          collection(db, 'attendance_records'),
          where('traineeId', '==', traineeId),
          where('timestamp', '>=', startOfMonth.getTime()),
          where('timestamp', '<=', endOfMonth.getTime()),
          orderBy('timestamp', 'desc'),
          limit(500),
        )
      );

      const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));

      const daysInMonth = endOfMonth.getDate();
      const days: CalendarDay[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dayStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const dayEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 23, 59, 59, 999);
        const dayStartMs = dayStart.getTime();
        const dayEndMs = dayEnd.getTime();

        const dayRecords = records.filter(
          (r) => r.timestamp >= dayStartMs && r.timestamp <= dayEndMs
        );

        days.push({
          date: dayStart,
          isCurrentMonth: true,
          hasTimeIn: dayRecords.some((r) => r.type === 'time_in'),
          hasTimeOut: dayRecords.some((r) => r.type === 'time_out'),
          records: dayRecords,
        });
      }

      setCalendarDays(days);
    } catch (err) {
      console.error('Failed to load attendance history:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, currentMonth]);

  useEffect(() => {
    fetchAttendanceForMonth();
  }, [fetchAttendanceForMonth]);

  const navigateMonth = (direction: number) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
    setSelectedDay(null);
  };

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Attendance History</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Previous month"
          >
            <svg className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[140px] text-center">
            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Next month"
          >
            <svg className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          <div role="grid" aria-label={`${currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })} attendance calendar`} className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
            {weekdays.map((day) => (
              <div key={day} className="bg-gray-50 dark:bg-gray-800 p-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                {day}
              </div>
            ))}

            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-white dark:bg-gray-800 p-2 min-h-[60px]" />
            ))}

            {calendarDays.map((day, i) => {
              const dateStr = day.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
              const statusParts: string[] = [];
              if (day.hasTimeIn) statusParts.push('Time In recorded');
              if (day.hasTimeOut) statusParts.push('Time Out recorded');
              const statusStr = statusParts.length > 0 ? statusParts.join(', ') : 'No attendance';
              const ariaLabel = `${dateStr} - ${statusStr}`;
              return (
              <button
                key={i}
                aria-label={ariaLabel}
                onClick={() => setSelectedDay(day)}
                className={`bg-white dark:bg-gray-800 p-2 min-h-[60px] text-left transition-colors ${
                  selectedDay?.date.getTime() === day.date.getTime()
                    ? 'ring-2 ring-inset ring-blue-500'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {day.date.getDate()}
                </span>
                <div className="flex gap-1 mt-1">
                  {day.hasTimeIn && (
                    <span className="w-2 h-2 rounded-full bg-green-500" title="Time In" />
                  )}
                  {day.hasTimeOut && (
                    <span className="w-2 h-2 rounded-full bg-red-500" title="Time Out" />
                  )}
                  {!day.hasTimeIn && !day.hasTimeOut && day.date <= new Date() && (
                    <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" title="No attendance" />
                  )}
                </div>
              </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Time In
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Time Out
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" /> No Record
            </span>
          </div>

          {selectedDay && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                {selectedDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              {selectedDay.records.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No attendance records for this day.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDay.records.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${record.type === 'time_in' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {record.type === 'time_in' ? 'Time In' : 'Time Out'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Session: {record.qrSessionId.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {formatTime12(record.timestamp)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
