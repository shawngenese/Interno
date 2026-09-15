/**
 * Edge Function: calculate_dtr
 *
 * Calculates Daily Time Record (DTR) for a trainee over a date range.
 * Called by client via `callEdgeFunction('calculate_dtr', { traineeId, startDate, endDate, forceRecalc })`.
 *
 * Body:
 * {
 *   traineeId: string,           // required
 *   startDate: number,           // epoch ms (inclusive)
 *   endDate: number,             // epoch ms (inclusive)
 *   forceRecalc?: boolean        // default false - if true, overwrites existing DTRs
 * }
 *
 * Returns:
 * {
 *   success: true,
 *   calculated: number,          // number of DTR entries created/updated
 *   dtrs: DTR[]                  // calculated DTR entries
 * }
 *
 * Calculation logic (PH labor law aware):
 * - Work schedule defines: timeIn, timeOut, breakDurationMinutes, workDays (0-6)
 * - Late: actual time_in > scheduled time_in + grace (configurable, default 10 min)
 * - Undertime: actual time_out < scheduled time_out - grace (default 10 min)
 * - Regular hours: min(actual hours - break, scheduled hours)
 * - Overtime: actual hours > scheduled hours (after break)
 * - Night differential: 10PM - 6AM hours * rate (placeholder)
 * - Holiday pay: separate schedule (placeholder)
 *
 * Attendance rules:
 * - Only attendance_records within trainee's company are considered
 * - time_in/time_out pairs must be on same day
 * - Missing time_out: undertime = scheduled hours, flag for correction
 * - Duplicate time_in: ignore subsequent
 *
 * Writes to dtrs collection (one per day per trainee).
 * Audit log on create/update.
 */
import { serve } from 'std/http/server.ts';
import { initAdmin, getAuthInstance, getDbInstance, COLLECTIONS, AUDIT_ACTIONS } from '../_shared/config.ts';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { corsResponse, errorResponse } from '../_shared/cors.ts';
import { verifyFirebaseToken } from '../_shared/auth.ts';

function getDayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function getDayEnd(date: Date): number {
  return getDayStart(date) + 24 * 60 * 60 * 1000 - 1;
}

function parseTimeString(timeStr: string, baseDate: Date): number {
  // timeStr format: "HH:MM" (24-hour)
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

function minutesToHours(minutes: number): number {
  return Number((minutes / 60).toFixed(2));
}

function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

interface WorkSchedule {
  id: string;
  companyId: string;
  name: string;
  timeIn: string;              // "08:00"
  timeOut: string;             // "17:00"
  breakDurationMinutes: number;
  workDays: number[];          // 0=Sun, 1=Mon, ..., 6=Sat
}

interface AttendanceRecord {
  id: string;
  traineeId: string;
  type: 'time_in' | 'time_out';
  timestamp: number;           // epoch ms
  qrSessionId: string;
  deviceInfo?: Record<string, unknown>;
  location?: Record<string, unknown>;
}

interface DTREntry {
  id: string;
  traineeId: string;
  date: number;                // day start epoch ms
  companyId: string;
  scheduleId: string;
  // Raw
  actualTimeIn?: number;
  actualTimeOut?: number;
  // Calculated
  scheduledTimeIn: number;
  scheduledTimeOut: number;
  scheduledBreakMinutes: number;
  scheduledWorkMinutes: number;
  actualWorkMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  nightDiffMinutes: number;
  isHoliday: boolean;
  holidayName?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'corrected';
  // Metadata
  createdAt: number;
  updatedAt: number;
  approvedAt?: number;
  approvedBy?: string;
  correctionRequestId?: string;
}

const GRACE_MINUTES = 10;           // grace period for late/undertime
const NIGHT_DIFF_START = 22 * 60; // 10:00 PM in minutes from midnight
const NIGHT_DIFF_END = 6 * 60;    // 6:00 AM

// PH Regular Holidays (fixed dates, month is 0-indexed)
// Expand as needed or fetch from a holidays collection
const PH_HOLIDAYS: { month: number; day: number; name: string }[] = [
  { month: 0, day: 1, name: "New Year's Day" },
  { month: 3, day: 9, name: "Araw ng Kagitingan" },
  { month: 4, day: 1, name: "Labor Day" },
  { month: 5, day: 12, name: "Independence Day" },
  { month: 7, day: 21, name: "Ninoy Aquino Day" },
  { month: 9, day: 1, name: "All Saints' Day" },
  { month: 10, day: 30, name: "Bonifacio Day" },
  { month: 11, day: 25, name: "Christmas Day" },
  { month: 11, day: 30, name: "Rizal Day" },
  { month: 11, day: 31, name: "Last Day of Year" },
];

function isHoliday(date: Date): { isHoliday: boolean; name: string } {
  const month = date.getMonth();
  const day = date.getDate();
  const found = PH_HOLIDAYS.find((h) => h.month === month && h.day === day);
  return found ? { isHoliday: true, name: found.name } : { isHoliday: false, name: '' };
}

function isWorkDay(schedule: WorkSchedule, date: Date): boolean {
  return schedule.workDays.includes(date.getDay());
}

function calculateNightDiffMinutes(timeIn: number, timeOut: number): number {
  const start = new Date(timeIn);
  const end = new Date(timeOut);
  let nightMinutes = 0;

  // Iterate each minute (could optimize but DTR calc is not high-frequency)
  const current = new Date(start);
  while (current < end) {
    const hour = current.getHours();
    const minute = current.getMinutes();
    const totalMinutes = hour * 60 + minute;
    // Night diff: 22:00-23:59 and 0:00-5:59
    if (totalMinutes >= NIGHT_DIFF_START || totalMinutes < NIGHT_DIFF_END) {
      nightMinutes++;
    }
    current.setMinutes(current.getMinutes() + 1);
  }
  return nightMinutes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse({});

  try {
    initAdmin();
    const auth = getAuthInstance();
    const db = getDbInstance();

    // Verify Firebase ID token from request body
    const [verified, errResp] = await verifyFirebaseToken(req);
    if (errResp) return errResp;
    const decoded = verified!;
    const callerUid = decoded.uid;
    const callerRole = (decoded as Record<string, unknown>).role as string | undefined;
    const callerCompanyId = (decoded as Record<string, unknown>).companyId as string | undefined;

    if (!callerCompanyId) {
      return errorResponse('Caller missing companyId in custom claims', 400);
    }
    if (!['admin', 'supervisor', 'trainee', 'coordinator'].includes(callerRole)) {
      return errorResponse('Invalid role for DTR calculation', 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { traineeId, startDate, endDate, forceRecalc = false } = body as {
      traineeId: string;
      startDate: number;
      endDate: number;
      forceRecalc?: boolean;
    };

    if (!traineeId || !startDate || !endDate) {
      return errorResponse('traineeId, startDate, endDate are required', 400);
    }
    if (startDate > endDate) {
      return errorResponse('startDate must be <= endDate', 400);
    }

    // Authorization: trainee can only calc own DTR; supervisor/admin can calc assigned
    const traineeSnap = await db.doc(COLLECTIONS.TRAINEES + '/' + traineeId).get();
    if (!traineeSnap.exists()) {
      return errorResponse('Trainee not found', 404);
    }
    const traineeData = traineeSnap.data() as Record<string, unknown>;
    if (traineeData.companyId !== callerCompanyId) {
      return errorResponse('Trainee not in your company', 403);
    }

    // Supervisor must be assigned to this trainee
    if (callerRole === 'supervisor') {
      const supSnap = await db.doc(COLLECTIONS.SUPERVISORS + '/' + callerUid).get();
      if (!supSnap.exists()) {
        return errorResponse('Supervisor profile not found', 404);
      }
      const assignedTrainees = (supSnap.data() as Record<string, unknown>).assignedTrainees as string[] | undefined;
      if (!assignedTrainees?.includes(traineeId)) {
        return errorResponse('Not authorized for this trainee', 403);
      }
    }
    if (callerRole === 'trainee' && traineeData.userId !== callerUid) {
      return errorResponse('Trainees can only calculate their own DTR', 403);
    }

    // Get trainee's schedule
    const scheduleId = traineeData.scheduleId as string | undefined;
    if (!scheduleId) {
      return errorResponse('Trainee has no work schedule assigned', 400);
    }
    const scheduleSnap = await db.doc(COLLECTIONS.WORK_SCHEDULES + '/' + scheduleId).get();
    if (!scheduleSnap.exists()) {
      return errorResponse('Work schedule not found', 404);
    }
    const schedule = scheduleSnap.data() as WorkSchedule;

    // Get attendance records in range
    const attendanceSnap = await db.collection(COLLECTIONS.ATTENDANCE_RECORDS)
      .where('traineeId', '==', traineeId)
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate)
      .orderBy('timestamp', 'asc')
      .get();

    const attendances = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));

    // Group by day
    const byDay = new Map<number, { timeIn?: number; timeOut?: number; sessions: string[] }>();
    for (const a of attendances) {
      const dayStart = getDayStart(new Date(a.timestamp));
      if (!byDay.has(dayStart)) byDay.set(dayStart, { sessions: [] });
      const day = byDay.get(dayStart)!;
      day.sessions.push(a.qrSessionId);
      if (a.type === 'time_in' && !day.timeIn) day.timeIn = a.timestamp;
      if (a.type === 'time_out' && !day.timeOut) day.timeOut = a.timestamp;
    }

    // Calculate DTR for each day in range
    const dtrBatch = db.batch();
    const auditBatch = db.batch();
    let calculated = 0;
    const results: DTREntry[] = [];

    for (let dayMs = startDate; dayMs <= endDate; dayMs += 24 * 60 * 60 * 1000) {
      const dayDate = new Date(dayMs);
      if (!isWorkDay(schedule, dayDate)) continue; // Skip non-work days

      const dayData = byDay.get(dayMs);
      const actualTimeIn = dayData?.timeIn;
      const actualTimeOut = dayData?.timeOut;

      // Scheduled times for this day
      const scheduledTimeIn = parseTimeString(schedule.timeIn, dayDate);
      const scheduledTimeOut = parseTimeString(schedule.timeOut, dayDate);
      const scheduledBreakMinutes = schedule.breakDurationMinutes;
      const scheduledWorkMinutes = (scheduledTimeOut - scheduledTimeIn) / 1000 / 60 - scheduledBreakMinutes;

      let actualWorkMinutes = 0;
      let lateMinutes = 0;
      let undertimeMinutes = 0;
      let nightDiffMinutes = 0;

      // PH holiday check
      const currentDate = new Date(dayMs);
      const holidayInfo = isHoliday(currentDate);

      if (actualTimeIn && actualTimeOut) {
        const workMs = actualTimeOut - actualTimeIn;
        const totalMinutes = workMs / 1000 / 60;
        actualWorkMinutes = Math.max(0, totalMinutes - scheduledBreakMinutes);

        // Late calculation
        if (actualTimeIn > scheduledTimeIn + GRACE_MINUTES * 60 * 1000) {
          lateMinutes = (actualTimeIn - scheduledTimeIn) / 1000 / 60;
        }

        // Undertime calculation
        if (actualTimeOut < scheduledTimeOut - GRACE_MINUTES * 60 * 1000) {
          undertimeMinutes = (scheduledTimeOut - actualTimeOut) / 1000 / 60;
        }

        // Night differential
        nightDiffMinutes = calculateNightDiffMinutes(actualTimeIn, actualTimeOut);
      } else if (actualTimeIn && !actualTimeOut) {
        // Missing time_out - full undertime
        undertimeMinutes = scheduledWorkMinutes;
      }

      const regularMinutes = Math.min(actualWorkMinutes, scheduledWorkMinutes);
      const overtimeMinutes = Math.max(0, actualWorkMinutes - scheduledWorkMinutes);

      // DTR document ID: traineeId_dayStart
      const dtrId = `${traineeId}_${dayMs}`;
      const dtrRef = db.doc(COLLECTIONS.DTRS + '/' + dtrId);

      // Check existing
      const existingSnap = await dtrRef.get();
      const existing = existingSnap.exists ? existingSnap.data() as DTREntry : null;

      if (existing && !forceRecalc) {
        // Skip if not forced
        continue;
      }

      const now = Date.now();
      const dtrEntry: DTREntry = {
        id: dtrId,
        traineeId,
        date: dayMs,
        companyId: callerCompanyId,
        scheduleId,
        actualTimeIn,
        actualTimeOut,
        scheduledTimeIn,
        scheduledTimeOut,
        scheduledBreakMinutes,
        scheduledWorkMinutes,
        actualWorkMinutes,
        regularMinutes,
        overtimeMinutes,
        lateMinutes,
        undertimeMinutes,
        nightDiffMinutes,
        isHoliday: holidayInfo.isHoliday,
        holidayName: holidayInfo.name || undefined,
        status: existing?.status === 'approved' ? 'corrected' : 'draft',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        ...(existing?.status === 'approved' && { correctionRequestId: `corr_${now}` }),
      };

      dtrBatch.set(dtrRef, dtrEntry, { merge: true });
      calculated++;

      // Audit log
      const auditRef = db.collection(COLLECTIONS.AUDIT_LOGS).doc();
      auditBatch.set(auditRef, {
        timestamp: Timestamp.fromMillis(now),
        userId: callerUid,
        action: existing ? 'update' : 'create',
        entityType: 'dtr',
        entityId: dtrId,
        originalValue: existing ? { status: existing.status } : null,
        newValue: {
          date: dayMs,
          actualTimeIn,
          actualTimeOut,
          regularMinutes,
          overtimeMinutes,
          lateMinutes,
          undertimeMinutes,
          status: dtrEntry.status,
        },
        metadata: { via: 'calculate_dtr', scheduleId, action: existing ? 'recalc' : 'create' },
      });

      results.push(dtrEntry);
    }

    if (calculated > 0) {
      await dtrBatch.commit();
      await auditBatch.commit();
    }

    return corsResponse({ success: true, calculated, dtrs: results });
  } catch (err) {
    console.error('[calculate_dtr] error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});