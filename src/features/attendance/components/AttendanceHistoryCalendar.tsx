import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { formatTime12 } from '@/shared/utils/dateUtils';
import { Skeleton } from '@/shared/components/Skeleton';
import { Button } from '@/shared/components/ui/Button';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  AlertTriangle,
  FileClock,
  CalendarCheck,
  UserX,
  Umbrella,
  Percent,
} from 'lucide-react';
import type { AttendanceRecord } from '../types';

interface LeaveInfo {
  id: string;
  type: string;
  reason: string;
  startDate: number;
  endDate: number;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  isPastOrToday: boolean;
  isToday: boolean;
  hasTimeIn: boolean;
  hasTimeOut: boolean;
  records: AttendanceRecord[];
  leave?: LeaveInfo;
  status: 'present' | 'partial' | 'leave' | 'absent' | 'future' | 'weekend';
}

export function AttendanceHistoryCalendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

      // Fetch attendance records & approved leaves concurrently
      const [recordsSnap, leavesSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'attendance_records'),
            where('traineeId', '==', traineeId),
            where('timestamp', '>=', startOfMonth.getTime()),
            where('timestamp', '<=', endOfMonth.getTime()),
            orderBy('timestamp', 'desc'),
            limit(500),
          )
        ),
        getDocs(
          query(
            collection(db, 'leave_requests'),
            where('traineeId', '==', traineeId),
            where('status', '==', 'approved'),
            where('startDate', '<=', endOfMonth.getTime()),
            limit(100),
          )
        ).catch(() => ({ docs: [] })),
      ]);

      const records = recordsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
      const leaves: LeaveInfo[] = leavesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as LeaveInfo))
        .filter((l) => l.endDate >= startOfMonth.getTime());

      const daysInMonth = endOfMonth.getDate();
      const days: CalendarDay[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let day = 1; day <= daysInMonth; day++) {
        const dayStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 0, 0, 0, 0);
        const dayEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 23, 59, 59, 999);
        const dayStartMs = dayStart.getTime();
        const dayEndMs = dayEnd.getTime();

        const dayOfWeek = dayStart.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isPastOrToday = dayStart.getTime() <= today.getTime();
        const isToday = dayStart.getTime() === today.getTime();

        const dayRecords = records.filter(
          (r) => r.timestamp >= dayStartMs && r.timestamp <= dayEndMs
        );

        const hasTimeIn = dayRecords.some((r) => r.type === 'time_in');
        const hasTimeOut = dayRecords.some((r) => r.type === 'time_out');

        const activeLeave = leaves.find(
          (l) => l.startDate <= dayEndMs && l.endDate >= dayStartMs
        );

        let status: CalendarDay['status'] = 'future';
        if (hasTimeIn && hasTimeOut) {
          status = 'present';
        } else if (hasTimeIn && !hasTimeOut) {
          status = 'partial';
        } else if (activeLeave) {
          status = 'leave';
        } else if (isWeekend) {
          status = 'weekend';
        } else if (isPastOrToday) {
          status = 'absent';
        }

        days.push({
          date: dayStart,
          isCurrentMonth: true,
          isWeekend,
          isPastOrToday,
          isToday,
          hasTimeIn,
          hasTimeOut,
          records: dayRecords,
          leave: activeLeave,
          status,
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

  // Summary counts for current viewed month
  const monthSummary = useMemo(() => {
    let presentCount = 0;
    let partialCount = 0;
    let absentCount = 0;
    let leaveCount = 0;

    calendarDays.forEach((day) => {
      if (day.status === 'present') presentCount++;
      else if (day.status === 'partial') partialCount++;
      else if (day.status === 'absent') absentCount++;
      else if (day.status === 'leave') leaveCount++;
    });

    const totalTracked = presentCount + partialCount + absentCount;
    const rate = totalTracked > 0 ? Math.round(((presentCount + partialCount) / totalTracked) * 100) : 100;

    return {
      present: presentCount + partialCount,
      absent: absentCount,
      leave: leaveCount,
      rate,
    };
  }, [calendarDays]);

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6 space-y-5">
      {/* Header & Month Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Attendance & Absences Record</h2>
            <p className="text-xs text-muted-foreground">Monthly breakdown of time punches, excused leaves, and absences</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => navigateMonth(-1)}
            className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border border-border"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs sm:text-sm font-bold text-foreground min-w-[130px] text-center">
            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border border-border"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Monthly KPI Summary Strip */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-muted/30 border border-border rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center text-success shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Present Days</p>
              <p className="text-base font-bold text-foreground">{monthSummary.present} days</p>
            </div>
          </div>

          <div className="bg-muted/30 border border-border rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
              <UserX className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Absences</p>
              <p className="text-base font-bold text-destructive">{monthSummary.absent} days</p>
            </div>
          </div>

          <div className="bg-muted/30 border border-border rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Umbrella className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Excused Leaves</p>
              <p className="text-base font-bold text-foreground">{monthSummary.leave} days</p>
            </div>
          </div>

          <div className="bg-muted/30 border border-border rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Percent className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Attendance Rate</p>
              <p className="text-base font-bold text-foreground">{monthSummary.rate}%</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton variant="rectangular" height={260} className="rounded-xl" />
        </div>
      ) : (
        <>
          {/* Calendar Grid */}
          <div
            role="grid"
            aria-label={`${currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })} attendance calendar`}
            className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border"
          >
            {weekdays.map((day) => (
              <div key={day} className="bg-muted p-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {day}
              </div>
            ))}

            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-card/40 p-2 min-h-[64px]" />
            ))}

            {calendarDays.map((day, i) => {
              const dateStr = day.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
              let statusLabel = 'Future Date';
              if (day.status === 'present') statusLabel = 'Present (Complete Day)';
              else if (day.status === 'partial') statusLabel = 'Timed In (Partial)';
              else if (day.status === 'leave') statusLabel = `On Leave (${day.leave?.type || 'Excused'})`;
              else if (day.status === 'absent') statusLabel = 'Absent (No Punch)';
              else if (day.status === 'weekend') statusLabel = 'Weekend';

              const ariaLabel = `${dateStr} - ${statusLabel}`;
              const isSelected = selectedDay?.date.getTime() === day.date.getTime();

              return (
                <button
                  key={i}
                  aria-label={ariaLabel}
                  onClick={() => setSelectedDay(day)}
                  className={`bg-card p-2 min-h-[64px] text-left transition-colors relative flex flex-col justify-between ${
                    isSelected
                      ? 'ring-2 ring-inset ring-primary bg-primary/5'
                      : 'hover:bg-muted/40'
                  } ${day.isToday ? 'bg-primary/[0.03]' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${day.isToday ? 'text-primary font-extrabold' : 'text-foreground'}`}>
                      {day.date.getDate()}
                    </span>
                    {day.isToday && (
                      <span className="text-[9px] font-semibold bg-primary text-primary-foreground px-1 rounded">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                    {day.status === 'present' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success">
                        <span className="w-2 h-2 rounded-full bg-success" />
                        <span className="hidden sm:inline">Present</span>
                      </span>
                    )}
                    {day.status === 'partial' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-warning">
                        <span className="w-2 h-2 rounded-full bg-warning" />
                        <span className="hidden sm:inline">Timed In</span>
                      </span>
                    )}
                    {day.status === 'leave' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        <span className="hidden sm:inline">Leave</span>
                      </span>
                    )}
                    {day.status === 'absent' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive">
                        <span className="w-2 h-2 rounded-full bg-destructive" />
                        <span className="hidden sm:inline">Absent</span>
                      </span>
                    )}
                    {day.status === 'weekend' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" title="Weekend" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success" /> Present
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-warning" /> Incomplete Punch
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive" /> Absent (Workday)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Excused Leave
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" /> Weekend / Off
            </span>
          </div>

          {/* Selected Day Detail Card */}
          {selectedDay && (
            <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  {selectedDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>

                <div>
                  {selectedDay.status === 'present' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success border border-success/30">
                      Present • Complete Day
                    </span>
                  )}
                  {selectedDay.status === 'partial' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warning/15 text-warning border border-warning/30">
                      Timed In Only
                    </span>
                  )}
                  {selectedDay.status === 'absent' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/30">
                      Marked as Absent
                    </span>
                  )}
                  {selectedDay.status === 'leave' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/30">
                      Excused Leave
                    </span>
                  )}
                  {selectedDay.status === 'weekend' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                      Weekend
                    </span>
                  )}
                </div>
              </div>

              {selectedDay.status === 'absent' && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-destructive">No Attendance Scan Recorded</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        You were marked absent for this workday. If you were present and missed scanning your QR code, you can submit a DTR correction request.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate('/trainee/dtr')}
                    className="shrink-0"
                  >
                    <FileClock className="w-3.5 h-3.5 mr-1.5 text-warning" />
                    Request DTR Correction
                  </Button>
                </div>
              )}

              {selectedDay.status === 'leave' && selectedDay.leave && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3.5 space-y-1">
                  <p className="text-xs font-bold text-primary capitalize">
                    Approved Leave: {selectedDay.leave.type.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reason: {selectedDay.leave.reason}
                  </p>
                </div>
              )}

              {selectedDay.records.length > 0 && (
                <div className="space-y-2 pt-1">
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
