import { getAdminDb, type AuditAction, type EntityType, COLLECTIONS } from '../config';
import { Timestamp } from 'firebase-admin/firestore';

export interface AuditLogEntry {
  timestamp: Timestamp;
  userId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  originalValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AuditLogContext {
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: Record<string, unknown>;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  correlationId?: string;
}

const db = getAdminDb();

export async function logAction(
  entry: Omit<AuditLogEntry, 'timestamp'>,
  context?: AuditLogContext
): Promise<void> {
  const auditEntry: AuditLogEntry = {
    ...entry,
    timestamp: Timestamp.now(),
    metadata: {
      ...entry.metadata,
      ...context,
    },
  };

  await db.collection(COLLECTIONS.AUDIT_LOGS).add(auditEntry);
}

export async function logActionBatch(
  entries: Omit<AuditLogEntry, 'timestamp'>[],
  context?: AuditLogContext
): Promise<void> {
  const batch = db.batch();
  const now = Timestamp.now();

  for (const entry of entries) {
    const docRef = db.collection(COLLECTIONS.AUDIT_LOGS).doc();
    batch.set(docRef, {
      ...entry,
      timestamp: now,
      metadata: {
        ...entry.metadata,
        ...context,
      },
    });
  }

  await batch.commit();
}

export async function logActionInTransaction(
  entry: Omit<AuditLogEntry, 'timestamp'>,
  transaction: FirebaseFirestore.Transaction,
  context?: AuditLogContext
): Promise<void> {
  const docRef = db.collection(COLLECTIONS.AUDIT_LOGS).doc();
  transaction.set(docRef, {
    ...entry,
    timestamp: Timestamp.now(),
    metadata: {
      ...entry.metadata,
      ...context,
    },
  });
}

export function createAuditEntry(
  userId: string,
  action: AuditAction,
  entityType: EntityType,
  entityId: string,
  originalValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
  metadata?: Record<string, unknown>
): Omit<AuditLogEntry, 'timestamp'> {
  return {
    userId,
    action,
    entityType,
    entityId,
    originalValue,
    newValue,
    metadata,
  };
}

export async function getAuditLogs(
  entityType: EntityType,
  entityId: string,
  limit = 50
): Promise<AuditLogEntry[]> {
  const snapshot = await db
    .collection(COLLECTIONS.AUDIT_LOGS)
    .where('entityType', '==', entityType)
    .where('entityId', '==', entityId)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as AuditLogEntry & { id: string }));
}

export async function getUserAuditLogs(
  userId: string,
  limit = 50
): Promise<AuditLogEntry[]> {
  const snapshot = await db
    .collection(COLLECTIONS.AUDIT_LOGS)
    .where('userId', '==', userId)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as AuditLogEntry & { id: string }));
}