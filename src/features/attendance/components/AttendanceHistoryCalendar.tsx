import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { formatTime12 } from '@/shared/utils/dateUtils';
import { Skeleton } from '@/shared/components/Skeleton';
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';
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
  }, [user, currentMonth]);

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
    <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Attendance History</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth(-1)}
            className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">
            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton variant="rectangular" height={220} className="rounded-xl" />
        </div>
      ) : (
        <>
          <div role="grid" aria-label={`${currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })} attendance calendar`} className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
            {weekdays.map((day) => (
              <div key={day} className="bg-muted p-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {day}
              </div>
            ))}

            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-card/50 p-2 min-h-[60px]" />
            ))}

            {calendarDays.map((day, i) => {
              const dateStr = day.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
              const statusParts: string[] = [];
              if (day.hasTimeIn) statusParts.push('Time In recorded');
              if (day.hasTimeOut) statusParts.push('Time Out recorded');
              const statusStr = statusParts.length > 0 ? statusParts.join(', ') : 'No attendance';
              const ariaLabel = `${dateStr} - ${statusStr}`;
              const isSelected = selectedDay?.date.getTime() === day.date.getTime();

              return (
                <button
                  key={i}
                  aria-label={ariaLabel}
                  onClick={() => setSelectedDay(day)}
                  className={`bg-card p-2 min-h-[60px] text-left transition-colors relative ${
                    isSelected
                      ? 'ring-2 ring-inset ring-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <span className="text-xs font-semibold text-foreground">
                    {day.date.getDate()}
                  </span>
                  <div className="flex gap-1 mt-1.5">
                    {day.hasTimeIn && (
                      <span className="w-2 h-2 rounded-full bg-success" title="Time In" />
                    )}
                    {day.hasTimeOut && (
                      <span className="w-2 h-2 rounded-full bg-primary" title="Time Out" />
                    )}
                    {!day.hasTimeIn && !day.hasTimeOut && day.date <= new Date() && (
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/30" title="No attendance" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success" /> Time In
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Time Out
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" /> No Record
            </span>
          </div>

          {selectedDay && (
            <div className="mt-6 p-4 bg-muted/30 rounded-xl border border-border">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                {selectedDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              {selectedDay.records.length === 0 ? (
                <p className="text-xs text-muted-foreground">No attendance records for this day.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDay.records.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${record.type === 'time_in' ? 'bg-success' : 'bg-primary'}`} />
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {record.type === 'time_in' ? 'Time In' : 'Time Out'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Session: {record.qrSessionId.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        {formatTime12(record.timestamp)}
                      </div>
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

