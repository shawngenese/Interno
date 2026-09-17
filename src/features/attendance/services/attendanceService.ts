import { getFunctionsInstancePublic } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import type { QueryConstraint } from 'firebase/firestore';

export interface AttendanceRecord {
  id: string;
  traineeId: string;
  type: 'time_in' | 'time_out';
  timestamp: number;
  qrSessionId: string;
  deviceInfo?: Record<string, unknown>;
  location?: { latitude: number; longitude: number; accuracy?: number };
  createdAt: { seconds: number; nanoseconds: number };
}

export interface QRSession {
  id: string;
  companyId: string;
  action: 'time_in' | 'time_out';
  expiresAt: number;
  createdBy: string;
  used: boolean;
  usedAt?: number;
  usedBy?: string;
  createdAt: { seconds: number; nanoseconds: number };
}

export interface GenerateQRResult {
  token: string;
  qrDataUrl: string;
  expiresAt: number;
  sessionId: string;
}

export interface ValidateQRResult {
  success: boolean;
  action: 'time_in' | 'time_out';
  timestamp: number;
  attendanceId: string;
  message: string;
}

export interface TodayAttendanceStatus {
  hasTimeIn: boolean;
  hasTimeOut: boolean;
  timeInRecord?: AttendanceRecord;
  timeOutRecord?: AttendanceRecord;
}

const LIST_FETCH_CAP = 500;

/** Generate QR token for supervisor display (time_in/time_out). */
export async function generateQRToken(
  action: 'time_in' | 'time_out',
  expirationSeconds: 30 | 60 | 120 | 300 = 60,
): Promise<GenerateQRResult> {
  const functions = getFunctionsInstancePublic();
  const generateQRTokenFn = httpsCallable<{ action: string; expirationSeconds: number }, GenerateQRResult>(functions, 'generateQRToken');
  const result = await generateQRTokenFn({ action, expirationSeconds });
  return result.data;
}

/** Validate scanned QR token and record attendance (trainee mobile). */
export async function validateQRScan(
  token: string,
  deviceInfo?: Record<string, unknown>,
  location?: { latitude: number; longitude: number; accuracy?: number },
): Promise<ValidateQRResult> {
  const functions = getFunctionsInstancePublic();
  const validateQRScanFn = httpsCallable<{ token: string; deviceInfo?: Record<string, unknown>; location?: { latitude: number; longitude: number; accuracy?: number } }, ValidateQRResult>(functions, 'validateQRScan');
  const result = await validateQRScanFn({ token, deviceInfo, location });
  return result.data;
}

/** Get today's attendance status for a trainee. */
export async function getTodayAttendance(traineeId: string): Promise<TodayAttendanceStatus> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = start + 24 * 60 * 60 * 1000 - 1;

  const snap = await getDocs(
    query(
      collection(db, 'attendance_records'),
      where('traineeId', '==', traineeId),
      where('timestamp', '>=', start),
      where('timestamp', '<=', end),
    ),
  );

  const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
  const timeInRecord = records.find((r) => r.type === 'time_in');
  const timeOutRecord = records.find((r) => r.type === 'time_out');

  return {
    hasTimeIn: !!timeInRecord,
    hasTimeOut: !!timeOutRecord,
    timeInRecord,
    timeOutRecord,
  };
}

/** List attendance records for a trainee (with pagination). */
export async function listAttendance(
  traineeId: string,
  options: { page?: number; limit?: number; startDate?: number; endDate?: number } = {},
): Promise<{ data: AttendanceRecord[]; total: number }> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const page = options.page ?? 1;
  const pageLimit = options.limit ?? 20;
  const constraints: QueryConstraint[] = [where('traineeId', '==', traineeId)];
  if (options.startDate) constraints.push(where('timestamp', '>=', options.startDate));
  if (options.endDate) constraints.push(where('timestamp', '<=', options.endDate));
  // NOTE: Firestore has no cursor-based pagination; we cap at LIST_FETCH_CAP (500) records
  // to avoid excessive reads. Trainers with >500 records may not see older entries.
  constraints.push(orderBy('timestamp', 'desc'), limit(LIST_FETCH_CAP));

  const snap = await getDocs(query(collection(db, 'attendance_records'), ...constraints));
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
  const start = (page - 1) * pageLimit;
  return {
    data: all.slice(start, start + pageLimit),
    total: all.length,
  };
}