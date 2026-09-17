import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { getAdminDb, COLLECTIONS, type QRAction } from '../config';
import { logAction, logActionInTransaction } from '../audit/auditLog';
import { assertRole } from '../utils/helpers';
import { Timestamp } from 'firebase-admin/firestore';

const QR_ACTIONS: readonly QRAction[] = ['time_in', 'time_out'] as const;

async function sha256Hex(input: string): Promise<string> {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function getTodayRange(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 24 * 60 * 60 * 1000 - 1;
  return { start, end };
}

export interface ValidateQRScanRequest {
  token: string;
  deviceInfo?: Record<string, unknown>;
  location?: { latitude: number; longitude: number; accuracy?: number };
}

export interface ValidateQRScanResponse {
  success: boolean;
  action: QRAction;
  timestamp: number;
  attendanceId: string;
  message: string;
}

export async function validateQRScanHandler(
  request: CallableRequest<ValidateQRScanRequest>
): Promise<ValidateQRScanResponse> {
  const traineeUid = assertRole(request.auth, ['trainee']);

  const db = getAdminDb();

  const userSnap = await db.doc(`${COLLECTIONS.USERS}/${traineeUid}`).get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'User profile not found');
  }
  const userData = userSnap.data()!;
  const traineeCompanyId = userData.companyId as string | undefined;
  if (!traineeCompanyId) {
    throw new HttpsError('invalid-argument', 'User missing companyId');
  }

  const traineeSnap = await db.collection(COLLECTIONS.TRAINEES)
    .where('userId', '==', traineeUid)
    .limit(1)
    .get();
  if (traineeSnap.empty) {
    throw new HttpsError('not-found', 'Trainee profile not found');
  }
  const traineeId = traineeSnap.docs[0].id;

  const { token, deviceInfo, location } = request.data;

  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'token is required');
  }

  const jwtSecret = process.env.QR_JWT_SECRET;
  if (!jwtSecret) {
    throw new HttpsError('failed-precondition', 'QR_JWT_SECRET not configured');
  }

  let payload: Record<string, unknown>;
  try {
    payload = jwt.verify(token, jwtSecret) as Record<string, unknown>;
  } catch {
    await logAction({
      userId: traineeUid,
      action: 'scan',
      entityType: 'qr_session',
      entityId: 'invalid',
      newValue: { reason: 'invalid_signature', traineeId },
    });
    throw new HttpsError('invalid-argument', 'Invalid or tampered QR token');
  }

  const { companyId, action, exp, nonce } = payload as {
    companyId: string;
    action: QRAction;
    exp: number;
    nonce: string;
  };

  if (!QR_ACTIONS.includes(action)) {
    throw new HttpsError('invalid-argument', `Invalid action in token: ${action}`);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (exp < nowSec) {
    await logAction({
      userId: traineeUid,
      action: 'scan',
      entityType: 'qr_session',
      entityId: 'expired',
      newValue: { reason: 'expired', exp, traineeId },
    });
    throw new HttpsError('invalid-argument', 'QR token has expired');
  }

  if (companyId !== traineeCompanyId) {
    await logAction({
      userId: traineeUid,
      action: 'scan',
      entityType: 'qr_session',
      entityId: 'company_mismatch',
      newValue: { reason: 'company_mismatch', tokenCompany: companyId, userCompany: traineeCompanyId, traineeId },
    });
    throw new HttpsError('permission-denied', 'QR token not valid for your company');
  }

  const tokenHash = await sha256Hex(token);
  const sessionsSnap = await db.collection(COLLECTIONS.QR_SESSIONS)
    .where('tokenHash', '==', tokenHash)
    .where('used', '==', false)
    .limit(1)
    .get();

  if (sessionsSnap.empty) {
    await logAction({
      userId: traineeUid,
      action: 'scan',
      entityType: 'qr_session',
      entityId: 'not_found_or_used',
      newValue: { reason: 'not_found_or_already_used', nonce, traineeId },
    });
    throw new HttpsError('invalid-argument', 'QR token not found or already used');
  }

  const sessionDoc = sessionsSnap.docs[0];
  const sessionData = sessionDoc.data();
  const sessionId = sessionDoc.id;

  if (sessionData.companyId !== companyId || sessionData.action !== action) {
    throw new HttpsError('invalid-argument', 'QR token mismatch');
  }
  if (sessionData.used) {
    throw new HttpsError('invalid-argument', 'QR token already used');
  }
  if (sessionData.expiresAt < Date.now()) {
    throw new HttpsError('invalid-argument', 'QR token expired');
  }

  const now = Date.now();
  const attendanceRef = db.collection(COLLECTIONS.ATTENDANCE_RECORDS).doc();

  await db.runTransaction(async (tx) => {
    tx.update(sessionDoc.ref, { used: true, usedAt: now, usedBy: traineeUid });

    const { start: dayStart, end: dayEnd } = getTodayRange();
    const todayAttendance = await db.collection(COLLECTIONS.ATTENDANCE_RECORDS)
      .where('traineeId', '==', traineeId)
      .where('timestamp', '>=', dayStart)
      .where('timestamp', '<=', dayEnd)
      .get();

    const hasTimeIn = todayAttendance.docs.some((d) => d.data().type === 'time_in');
    const hasTimeOut = todayAttendance.docs.some((d) => d.data().type === 'time_out');

    if (action === 'time_in' && hasTimeIn) {
      throw new HttpsError('failed-precondition', 'Already timed in today');
    }
    if (action === 'time_out') {
      if (!hasTimeIn) {
        throw new HttpsError('failed-precondition', 'Must time in before timing out');
      }
      if (hasTimeOut) {
        throw new HttpsError('failed-precondition', 'Already timed out today');
      }
    }

    tx.set(attendanceRef, {
      traineeId,
      type: action,
      timestamp: now,
      qrSessionId: sessionId,
      deviceInfo: deviceInfo ?? null,
      location: location ?? null,
      createdAt: Timestamp.fromMillis(now),
    });

    const auditRef = db.collection(COLLECTIONS.AUDIT_LOGS).doc();
    tx.set(auditRef, {
      timestamp: Timestamp.fromMillis(now),
      userId: traineeUid,
      action: 'scan',
      entityType: 'attendance_record',
      entityId: attendanceRef.id,
      originalValue: null,
      newValue: { action, qrSessionId: sessionId, traineeId, deviceInfo, location },
      metadata: { via: 'validateQRScan' },
    });
  });

  const actionLabel = action === 'time_in' ? 'Time In' : 'Time Out';
  return {
    success: true,
    action,
    timestamp: now,
    attendanceId: attendanceRef.id,
    message: `${actionLabel} recorded successfully`,
  };
}
