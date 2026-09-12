import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setUserRoleHandler, getCurrentUserRoleHandler } from './auth/customClaims';
import { logAction, getAuditLogs, getUserAuditLogs } from './audit/auditLog';
import { getAdminDb, COLLECTIONS, type AuditAction, type EntityType } from './config';

export const setUserRole = onCall<{
  uid: string;
  role: 'admin' | 'supervisor' | 'coordinator' | 'trainee';
  companyId?: string;
  departmentId?: string;
  supervisorId?: string;
  traineeId?: string;
}>(setUserRoleHandler);

export const getCurrentUserRole = onCall(getCurrentUserRoleHandler);

export const writeAuditLog = onCall<{
  userId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  originalValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}>(async (request) => {
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
}>(async (request) => {
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
}>(async (request) => {
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

export const healthCheck = onCall(async () => {
  return { status: 'ok', timestamp: Date.now() };
});

export const cleanupExpiredQRSessions = onCall(async (request) => {
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