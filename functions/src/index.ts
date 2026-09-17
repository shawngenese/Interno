import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setUserRoleHandler, getCurrentUserRoleHandler } from './auth/customClaims';
import { logAction, getAuditLogs, getUserAuditLogs } from './audit/auditLog';
import { getAdminDb, getAdminAuth, COLLECTIONS, type AuditAction, type EntityType } from './config';
import { generateQRTokenHandler } from './qr/generateQRToken';
import { validateQRScanHandler } from './qr/validateQRScan';
import { calculateDTRHandler } from './dtr/calculateDTR';
import { validateUploadHandler } from './storage/validateUpload';
import { sendFCMNotificationHandler } from './notifications/sendFCM';
import { sendEmailHandler } from './notifications/sendEmail';
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

  const { userId, action, entityType, entityId, originalValue, newValue, metadata } = request.data;

  if (request.auth.uid !== userId && request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Cannot write audit log for another user');
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
  { region: REGION },
  generateQRTokenHandler
);

export const validateQRScan = onCall<{ token: string; deviceInfo?: Record<string, unknown>; location?: { latitude: number; longitude: number; accuracy?: number } }>(
  { region: REGION },
  validateQRScanHandler
);

export const calculateDTR = onCall<{ traineeId: string; startDate: number; endDate: number; forceRecalc?: boolean }>(
  { region: REGION },
  calculateDTRHandler
);

export const validateUpload = onCall<{ fileName: string; mimeType: string; fileSize: number; bucket: 'documents' | 'tasks' | 'profiles'; traineeId?: string; taskId?: string; userId?: string }>(
  { region: REGION },
  validateUploadHandler
);

export const sendFCMNotification = onCall<{ tokens?: string[]; topic?: string; title: string; body: string; data?: Record<string, string>; image?: string; priority?: 'high' | 'normal'; ttl?: number }>(
  { region: REGION },
  sendFCMNotificationHandler
);

export const sendEmail = onCall<{ to: string | string[]; subject: string; html: string; text?: string; replyTo?: string }>(
  { region: REGION },
  sendEmailHandler
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
