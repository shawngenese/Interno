import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { getAdminDb, COLLECTIONS } from '../config';
import { Timestamp } from 'firebase-admin/firestore';

interface WorkSchedule {
  id: string;
  companyId: string;
  name: string;
  timeIn: string;
  timeOut: string;
  breakDurationMinutes: number;
  workDays: number[];
}

interface AttendanceRecord {
  id: string;
  traineeId: string;
  type: 'time_in' | 'time_out';
  timestamp: number;
  qrSessionId: string;
}

interface DTREntry {
  id: string;
  traineeId: string;
  date: number;
  companyId: string;
  scheduleId: string;
  actualTimeIn?: number;
  actualTimeOut?: number;
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
  createdAt: number;
  updatedAt: number;
  approvedAt?: number;
  approvedBy?: string;
  correctionRequestId?: string;
}

const GRACE_MINUTES = 10;
const NIGHT_DIFF_START = 22 * 60;
const NIGHT_DIFF_END = 6 * 60;

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

function getDayStart(epochMs: number, tzOffsetMinutes = 0): number {
  const localMs = epochMs - tzOffsetMinutes * 60 * 1000;
  const date = new Date(localMs);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + tzOffsetMinutes * 60 * 1000;
}

function parseTimeString(timeStr: string, dayEpochMs: number, tzOffsetMinutes: number): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const localMs = dayEpochMs - tzOffsetMinutes * 60 * 1000;
  const date = new Date(localMs);
  const midnightUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return midnightUtc + tzOffsetMinutes * 60 * 1000 + (hours * 60 + minutes) * 60 * 1000;
}

function isHoliday(epochMs: number, tzOffsetMinutes: number): { isHoliday: boolean; name: string } {
  const localMs = epochMs - tzOffsetMinutes * 60 * 1000;
  const date = new Date(localMs);
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const found = PH_HOLIDAYS.find((h) => h.month === month && h.day === day);
  return found ? { isHoliday: true, name: found.name } : { isHoliday: false, name: '' };
}

function isWorkDay(schedule: WorkSchedule, epochMs: number, tzOffsetMinutes: number): boolean {
  const localMs = epochMs - tzOffsetMinutes * 60 * 1000;
  const date = new Date(localMs);
  return schedule.workDays.includes(date.getUTCDay());
}

function calculateNightDiffMinutes(timeIn: number, timeOut: number): number {
  const start = new Date(timeIn);
  const end = new Date(timeOut);
  let nightMinutes = 0;
  const current = new Date(start);
  while (current < end) {
    const hour = current.getHours();
    const minute = current.getMinutes();
    const totalMinutes = hour * 60 + minute;
    if (totalMinutes >= NIGHT_DIFF_START || totalMinutes < NIGHT_DIFF_END) {
      nightMinutes++;
    }
    current.setMinutes(current.getMinutes() + 1);
  }
  return nightMinutes;
}

export interface CalculateDTRRequest {
  traineeId: string;
  startDate: number;
  endDate: number;
  forceRecalc?: boolean;
  timezoneOffsetMinutes?: number;
}

export interface CalculateDTRResponse {
  success: boolean;
  calculated: number;
  dtrs: DTREntry[];
}

export async function calculateDTRHandler(
  request: CallableRequest<CalculateDTRRequest>
): Promise<CalculateDTRResponse> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const callerUid = request.auth.uid;
  const callerRole = request.auth.token?.role as string | undefined;
  const callerCompanyId = request.auth.token?.companyId as string | undefined;

  if (!callerCompanyId) {
    throw new HttpsError('invalid-argument', 'Caller missing companyId in custom claims');
  }
  if (!['admin', 'supervisor', 'trainee', 'coordinator'].includes(callerRole ?? '')) {
    throw new HttpsError('permission-denied', 'Invalid role for DTR calculation');
  }

  const { traineeId, startDate, endDate, forceRecalc = false, timezoneOffsetMinutes = 0 } = request.data;

  if (!traineeId || !startDate || !endDate) {
    throw new HttpsError('invalid-argument', 'traineeId, startDate, endDate are required');
  }
  if (startDate > endDate) {
    throw new HttpsError('invalid-argument', 'startDate must be <= endDate');
  }

  const db = getAdminDb();

  const traineeSnap = await db.doc(`${COLLECTIONS.TRAINEES}/${traineeId}`).get();
  if (!traineeSnap.exists) {
    throw new HttpsError('not-found', 'Trainee not found');
  }
  const traineeData = traineeSnap.data()!;
  if (traineeData.companyId !== callerCompanyId) {
    throw new HttpsError('permission-denied', 'Trainee not in your company');
  }

  if (callerRole === 'supervisor') {
    const supSnap = await db.doc(`${COLLECTIONS.SUPERVISORS}/${callerUid}`).get();
    if (!supSnap.exists) {
      throw new HttpsError('not-found', 'Supervisor profile not found');
    }
    const assignedTrainees = supSnap.data()!.assignedTrainees as string[] | undefined;
    if (!assignedTrainees?.includes(traineeId)) {
      throw new HttpsError('permission-denied', 'Not authorized for this trainee');
    }
  }
  if (callerRole === 'trainee' && traineeData.userId !== callerUid) {
    throw new HttpsError('permission-denied', 'Trainees can only calculate their own DTR');
  }

  const scheduleId = traineeData.scheduleId as string | undefined;
  if (!scheduleId) {
    throw new HttpsError('failed-precondition', 'Trainee has no work schedule assigned');
  }
  const scheduleSnap = await db.doc(`${COLLECTIONS.WORK_SCHEDULES}/${scheduleId}`).get();
  if (!scheduleSnap.exists) {
    throw new HttpsError('not-found', 'Work schedule not found');
  }
  const schedule = { id: scheduleSnap.id, ...scheduleSnap.data() } as WorkSchedule;

  const attendanceSnap = await db.collection(COLLECTIONS.ATTENDANCE_RECORDS)
    .where('traineeId', '==', traineeId)
    .where('timestamp', '>=', startDate)
    .where('timestamp', '<=', endDate)
    .orderBy('timestamp', 'asc')
    .get();

  const attendances = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));

  const byDay = new Map<number, { timeIn?: number; timeOut?: number; sessions: string[] }>();
  for (const a of attendances) {
    const dayStart = getDayStart(a.timestamp, timezoneOffsetMinutes);
    if (!byDay.has(dayStart)) byDay.set(dayStart, { sessions: [] });
    const day = byDay.get(dayStart)!;
    day.sessions.push(a.qrSessionId);
    if (a.type === 'time_in' && !day.timeIn) day.timeIn = a.timestamp;
    if (a.type === 'time_out' && !day.timeOut) day.timeOut = a.timestamp;
  }

  const dtrBatch = db.batch();
  const auditBatch = db.batch();
  let calculated = 0;
  const results: DTREntry[] = [];

  const dayStep = 24 * 60 * 60 * 1000;
  const firstDayMs = getDayStart(startDate, timezoneOffsetMinutes);
  for (let dayMs = firstDayMs; dayMs <= endDate; dayMs += dayStep) {
    if (!isWorkDay(schedule, dayMs, timezoneOffsetMinutes)) continue;

    const dayData = byDay.get(dayMs);
    const actualTimeIn = dayData?.timeIn;
    const actualTimeOut = dayData?.timeOut;

    const scheduledTimeIn = parseTimeString(schedule.timeIn, dayMs, timezoneOffsetMinutes);
    const scheduledTimeOut = parseTimeString(schedule.timeOut, dayMs, timezoneOffsetMinutes);
    const scheduledBreakMinutes = schedule.breakDurationMinutes;
    const scheduledWorkMinutes = (scheduledTimeOut - scheduledTimeIn) / 1000 / 60 - scheduledBreakMinutes;

    let actualWorkMinutes = 0;
    let lateMinutes = 0;
    let undertimeMinutes = 0;
    let nightDiffMinutes = 0;

    const holidayInfo = isHoliday(dayMs, timezoneOffsetMinutes);

    if (actualTimeIn && actualTimeOut) {
      const workMs = actualTimeOut - actualTimeIn;
      const totalMinutes = workMs / 1000 / 60;
      actualWorkMinutes = Math.max(0, totalMinutes - scheduledBreakMinutes);

      if (actualTimeIn > scheduledTimeIn + GRACE_MINUTES * 60 * 1000) {
        lateMinutes = (actualTimeIn - scheduledTimeIn) / 1000 / 60;
      }

      if (actualTimeOut < scheduledTimeOut - GRACE_MINUTES * 60 * 1000) {
        undertimeMinutes = (scheduledTimeOut - actualTimeOut) / 1000 / 60;
      }

      nightDiffMinutes = calculateNightDiffMinutes(actualTimeIn, actualTimeOut);
    } else if (actualTimeIn && !actualTimeOut) {
      undertimeMinutes = scheduledWorkMinutes;
    }

    const regularMinutes = Math.min(actualWorkMinutes, scheduledWorkMinutes);
    const overtimeMinutes = Math.max(0, actualWorkMinutes - scheduledWorkMinutes);

    const dtrId = `${traineeId}_${dayMs}`;
    const dtrRef = db.doc(`${COLLECTIONS.DTRS}/${dtrId}`);

    const existingSnap = await dtrRef.get();
    const existing = existingSnap.exists ? existingSnap.data() as DTREntry : null;

    if (existing && !forceRecalc) continue;

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
      metadata: { via: 'calculateDTR', scheduleId, action: existing ? 'recalc' : 'create' },
    });

    results.push(dtrEntry);
  }

  if (calculated > 0) {
    await dtrBatch.commit();
    await auditBatch.commit();
  }

  return { success: true, calculated, dtrs: results };
}
