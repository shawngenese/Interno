import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setUserRoleHandler, getCurrentUserRoleHandler } from './auth/customClaims';
import { logAction, getAuditLogs, getUserAuditLogs } from './audit/auditLog';
import { getAdminDb, getAdminAuth, COLLECTIONS, type AuditAction, type EntityType } from './config';
import { generateQRTokenHandler } from './qr/generateQRToken';
import { validateQRScanHandler } from './qr/validateQRScan';
import { qrJwtSecret } from './secrets';
import { calculateDTRHandler } from './dtr/calculateDTR';
import { approveDTRHandler } from './dtr/approveDTR';
import { rejectDTRHandler } from './dtr/rejectDTR';
import { reviewCorrectionRequestHandler } from './dtr/reviewCorrectionRequest';
import { validateUploadHandler } from './storage/validateUpload';
import { sendFCMNotificationHandler } from './notifications/sendFCM';
import { sendEmailHandler, assertCanSendEmail } from './notifications/sendEmail';
import { sendSupervisorInviteHandler } from './notifications/sendSupervisorInvite';
import { sendNotificationHandler, type SendNotificationRequest } from './notifications/sendNotification';
import { Timestamp } from 'firebase-admin/firestore';

const REGION = 'asia-southeast1';

export const setUserRole = onCall<{
  uid: string;
  role: 'admin' | 'supervisor' | 'coordinator' | 'trainee';
  companyId?: string;
  departmentId?: string;
  supervisorId?: string;
  traineeId?: string;
}>({ region: REGION }, setUserRoleHandler);

export const getCurrentUserRole = onCall({ region: REGION }, getCurrentUserRoleHandler);

export const writeAuditLog = onCall<{
  userId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  originalValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}>({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const callerRole = request.auth.token?.role as string | undefined;
  const { userId, action, entityType, entityId, originalValue, newValue, metadata } = request.data;

  if (request.auth.uid !== userId && callerRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Cannot write audit log for another user');
  }

  const SENSITIVE_ACTIONS: AuditAction[] = ['approve', 'reject', 'role_change', 'delete', 'update', 'archive'];
  if (SENSITIVE_ACTIONS.includes(action) && callerRole !== 'admin') {
    throw new HttpsError('permission-denied', `Action '${action}' requires admin role`);
  }

  await logAction(
    { userId, action, entityType, entityId, originalValue, newValue, metadata },
    { correlationId: request.rawRequest.headers['x-correlation-id'] as string }
  );

  return { success: true };
});

export const getAuditLogsByEntity = onCall<{
  entityType: EntityType;
  entityId: string;
  limit?: number;
}>({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const callerRole = request.auth.token?.role as string | undefined;
  if (!callerRole || !['admin', 'supervisor', 'coordinator'].includes(callerRole)) {
    throw new HttpsError('permission-denied', 'Required role: admin, supervisor, or coordinator');
  }

  const { entityType, entityId, limit = 50 } = request.data;
  const logs = await getAuditLogs(entityType, entityId, limit);

  return { logs };
});

export const getAuditLogsByUser = onCall<{
  userId: string;
  limit?: number;
}>({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId, limit = 50 } = request.data;

  if (request.auth.uid !== userId && request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Cannot view audit logs for another user');
  }

  const logs = await getUserAuditLogs(userId, limit);

  return { logs };
});

export const healthCheck = onCall({ region: REGION }, async () => {
  return { status: 'ok', timestamp: Date.now() };
});

export const cleanupExpiredQRSessions = onCall({ region: REGION }, async (request) => {
  if (!request.auth || request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin only');
  }

  const db = getAdminDb();
  const now = Date.now();
  const expiredSessions = await db
    .collection(COLLECTIONS.QR_SESSIONS)
    .where('expiresAt', '<', now)
    .where('used', '==', false)
    .get();

  const batch = db.batch();
  let count = 0;

  for (const doc of expiredSessions.docs) {
    batch.update(doc.ref, { used: true, expiredAt: now });
    count++;
  }

  await batch.commit();

  return { cleaned: count };
});

export const generateQRToken = onCall<{ action: 'time_in' | 'time_out'; expirationSeconds?: 30 | 60 | 120 | 300 }>(
  { region: REGION, secrets: [qrJwtSecret] },
  generateQRTokenHandler
);

export const validateQRScan = onCall<{ token: string; deviceInfo?: Record<string, unknown>; location?: { latitude: number; longitude: number; accuracy?: number } }>(
  { region: REGION, secrets: [qrJwtSecret] },
  validateQRScanHandler
);

export const calculateDTR = onCall<{ traineeId: string; startDate: number; endDate: number; forceRecalc?: boolean }>(
  { region: REGION },
  calculateDTRHandler
);

export const approveDTR = onCall<{ dtrId: string; notes?: string }>(
  { region: REGION },
  approveDTRHandler
);

export const rejectDTR = onCall<{ dtrId: string; reason?: string }>(
  { region: REGION },
  rejectDTRHandler
);

export const reviewCorrectionRequest = onCall<{
  dtrId: string;
  correctionRequestId: string;
  action: 'approve' | 'reject';
  notes?: string;
}>({ region: REGION }, reviewCorrectionRequestHandler);

export const validateUpload = onCall<{ fileName: string; mimeType: string; fileSize: number; bucket: 'documents' | 'tasks' | 'profiles'; traineeId?: string; taskId?: string; userId?: string }>(
  { region: REGION },
  validateUploadHandler
);

export const sendFCMNotification = onCall<{ tokens?: string[]; topic?: string; title: string; body: string; data?: Record<string, string>; image?: string; priority?: 'high' | 'normal'; ttl?: number }>(
  { region: REGION },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    const role = request.auth.token?.role as string | undefined;
    if (!role || !['admin', 'supervisor'].includes(role)) {
      throw new HttpsError('permission-denied', 'Required role: admin or supervisor');
    }
    return sendFCMNotificationHandler(request);
  }
);

export const sendEmail = onCall<{ to: string | string[]; subject: string; html: string; text?: string; replyTo?: string }>(
  { region: REGION },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    const role = request.auth.token?.role as string | undefined;
    assertCanSendEmail(role);
    return sendEmailHandler(request);
  }
);

export const sendSupervisorInvite = onCall<{ companyId: string; supervisorName: string; supervisorEmail: string }>(
  { region: REGION },
  sendSupervisorInviteHandler
);

export const sendNotification = onCall<SendNotificationRequest>(
  { region: REGION },
  sendNotificationHandler
);

export const deleteUserAccount = onCall<{ uid: string }>({ region: REGION }, async (request) => {
  if (!request.auth || request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin only');
  }

  const { uid } = request.data;
  if (!uid) {
    throw new HttpsError('invalid-argument', 'uid is required');
  }

  const db = getAdminDb();
  const auth = getAdminAuth();

  const userSnap = await db.doc(`${COLLECTIONS.USERS}/${uid}`).get();
  const userData = userSnap.exists ? userSnap.data() : null;

  await auth.deleteUser(uid);

  if (userSnap.exists) {
    await db.doc(`${COLLECTIONS.USERS}/${uid}`).update({
      status: 'archived',
      archivedAt: Timestamp.now(),
      archivedBy: request.auth.uid,
    });
  }

  await logAction({
    userId: request.auth.uid,
    action: 'delete',
    entityType: 'user',
    entityId: uid,
    originalValue: userData ? (userData.role !== undefined ? { email: userData.email, role: userData.role } : { email: userData.email }) : undefined,
    metadata: { via: 'deleteUserAccount', softDelete: true },
  });

  return { success: true };
});

/** One-time migration: activate trainees who have attendance records but ojtStatus is still pending. */
export const syncTraineeOJTStatus = onCall<{ dryRun?: boolean }>({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in');
  }

  const db = getAdminDb();

  const traineesSnap = await db.collection(COLLECTIONS.TRAINEES)
    .where('status', '==', 'active')
    .get();

  const results: { traineeId: string; oldStatus: string; newStatus: string }[] = [];

  for (const traineeDoc of traineesSnap.docs) {
    const traineeData = traineeDoc.data();
    const currentStatus = traineeData.ojtStatus as string | undefined;

    if (currentStatus && currentStatus !== 'pending') continue;

    const attendanceSnap = await db.collection(COLLECTIONS.ATTENDANCE_RECORDS)
      .where('traineeId', '==', traineeDoc.id)
      .limit(1)
      .get();

    if (!attendanceSnap.empty) {
      results.push({
        traineeId: traineeDoc.id,
        oldStatus: currentStatus ?? 'missing',
        newStatus: 'active',
      });

      if (!request.data.dryRun) {
        await traineeDoc.ref.update({
          ojtStatus: 'active',
          updatedAt: Timestamp.now(),
        });
      }
    }
  }

  await logAction({
    userId: request.auth.uid,
    action: 'update',
    entityType: 'trainee',
    entityId: 'batch',
    originalValue: { count: results.length },
    newValue: { results: results as unknown as Record<string, unknown> },
    metadata: { via: 'syncTraineeOJTStatus', dryRun: request.data.dryRun ?? false },
  });

  return { updated: results.length, details: results };
});


