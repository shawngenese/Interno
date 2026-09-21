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

export function deepClean<T>(obj?: T): T | undefined {
  if (obj == null) return undefined;
  if (Array.isArray(obj)) {
    const cleaned = obj.map((v) => deepClean(v)).filter((v) => v !== undefined);
    return (cleaned.length ? cleaned : undefined) as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const val = deepClean(v);
      if (val !== undefined) cleaned[k] = val;
    }
    return Object.keys(cleaned).length ? (cleaned as T) : undefined;
  }
  return obj === undefined ? undefined : obj;
}

export async function logAction(
  entry: Omit<AuditLogEntry, 'timestamp'>,
  context?: AuditLogContext
): Promise<void> {
  // Build the raw entry with all fields, then deep clean to remove any undefined values
  const rawEntry = {
    ...entry,
    timestamp: Timestamp.now(),
    ...context,
  };
  const auditEntry = deepClean(rawEntry);
  if (!auditEntry) {
    throw new Error('Audit entry resolved to undefined after cleaning');
  }
  await getAdminDb().collection(COLLECTIONS.AUDIT_LOGS).add(auditEntry as Record<string, unknown>);
}


export async function logActionBatch(
  entries: Omit<AuditLogEntry, 'timestamp'>[],
  context?: AuditLogContext
): Promise<void> {
  const adminDb = getAdminDb();
  const batch = adminDb.batch();
  const now = Timestamp.now();

  for (const entry of entries) {
    const docRef = adminDb.collection(COLLECTIONS.AUDIT_LOGS).doc();
    const cleanedEntry: Record<string, unknown> = {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      timestamp: now,
    };
    if (entry.originalValue) {
      const orig = deepClean(entry.originalValue);
      if (orig) cleanedEntry.originalValue = orig;
    }
    if (entry.newValue) {
      const newV = deepClean(entry.newValue);
      if (newV) cleanedEntry.newValue = newV;
    }
    const mergedMeta = deepClean({
      ...entry.metadata,
      ...context,
    });
    if (mergedMeta) cleanedEntry.metadata = mergedMeta;
    batch.set(docRef, cleanedEntry);
  }

  await batch.commit();
}

export async function logActionInTransaction(
  entry: Omit<AuditLogEntry, 'timestamp'>,
  transaction: FirebaseFirestore.Transaction,
  context?: AuditLogContext
): Promise<void> {
  const docRef = getAdminDb().collection(COLLECTIONS.AUDIT_LOGS).doc();
  const cleanedEntryTx: Record<string, unknown> = {
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    timestamp: Timestamp.now(),
  };
  if (entry.originalValue) {
    const orig = deepClean(entry.originalValue);
    if (orig) cleanedEntryTx.originalValue = orig;
  }
  if (entry.newValue) {
    const newV = deepClean(entry.newValue);
    if (newV) cleanedEntryTx.newValue = newV;
  }
  const mergedMetaTx = deepClean({
    ...entry.metadata,
    ...context,
  });
  if (mergedMetaTx) cleanedEntryTx.metadata = mergedMetaTx;
  transaction.set(docRef, cleanedEntryTx);
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
  const snapshot = await getAdminDb()
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
  const snapshot = await getAdminDb()
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