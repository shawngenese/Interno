import { getAdminDb, COLLECTIONS, type AuditAction, type EntityType } from '../src/config';
import { 
  logAction, 
  logActionBatch, 
  logActionInTransaction, 
  createAuditEntry,
  getAuditLogs,
  getUserAuditLogs 
} from '../src/audit/auditLog';
import { Timestamp } from 'firebase-admin/firestore';

const db = getAdminDb();

describe('Audit Log Functions', () => {
  const testUserId = 'test-user-123';
  const testEntityType: EntityType = 'user';
  const testEntityId = 'entity-456';
  const testAction: AuditAction = 'create';

  beforeEach(async () => {
    await db.collection(COLLECTIONS.AUDIT_LOGS)
      .where('userId', '==', testUserId)
      .get()
      .then(snapshot => {
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        return batch.commit();
      });
  });

  afterAll(async () => {
    await db.collection(COLLECTIONS.AUDIT_LOGS)
      .where('userId', '==', testUserId)
      .get()
      .then(snapshot => {
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        return batch.commit();
      });
  });

  describe('logAction', () => {
    it('should create a single audit log entry', async () => {
      await logAction({
        userId: testUserId,
        action: testAction,
        entityType: testEntityType,
        entityId: testEntityId,
      });

      const snapshot = await db.collection(COLLECTIONS.AUDIT_LOGS)
        .where('userId', '==', testUserId)
        .where('entityType', '==', testEntityType)
        .where('entityId', '==', testEntityId)
        .get();

      expect(snapshot.size).toBe(1);
      const doc = snapshot.docs[0];
      const data = doc.data();
      expect(data.userId).toBe(testUserId);
      expect(data.action).toBe(testAction);
      expect(data.entityType).toBe(testEntityType);
      expect(data.entityId).toBe(testEntityId);
      expect(data.timestamp).toBeInstanceOf(Timestamp);
    });

    it('should include originalValue and newValue when provided', async () => {
      const originalValue = { status: 'pending' };
      const newValue = { status: 'active' };

      await logAction({
        userId: testUserId,
        action: 'update',
        entityType: testEntityType,
        entityId: testEntityId,
        originalValue,
        newValue,
      });

      const snapshot = await db.collection(COLLECTIONS.AUDIT_LOGS)
        .where('userId', '==', testUserId)
        .where('action', '==', 'update')
        .get();

      expect(snapshot.size).toBe(1);
      const data = snapshot.docs[0].data();
      expect(data.originalValue).toEqual(originalValue);
      expect(data.newValue).toEqual(newValue);
    });

    it('should include metadata and context', async () => {
      const metadata = { source: 'api' };
      const context = { correlationId: 'corr-123', ipAddress: '127.0.0.1' };

      await logAction({
        userId: testUserId,
        action: testAction,
        entityType: testEntityType,
        entityId: testEntityId,
        metadata,
      }, context);

      const snapshot = await db.collection(COLLECTIONS.AUDIT_LOGS)
        .where('userId', '==', testUserId)
        .where('action', '==', testAction)
        .get();

      const data = snapshot.docs[0].data();
      expect(data.metadata).toMatchObject({
        source: 'api',
        correlationId: 'corr-123',
        ipAddress: '127.0.0.1',
      });
    });
  });

  describe('logActionBatch', () => {
    it('should create multiple audit log entries in a batch', async () => {
      const entries: Omit<import('../src/audit/auditLog').AuditLogEntry, 'timestamp'>[] = [
        { userId: testUserId, action: 'create', entityType: 'user', entityId: 'e1' },
        { userId: testUserId, action: 'update', entityType: 'user', entityId: 'e2' },
        { userId: testUserId, action: 'delete', entityType: 'user', entityId: 'e3' },
      ];

      await logActionBatch(entries);

      const snapshot = await db.collection(COLLECTIONS.AUDIT_LOGS)
        .where('userId', '==', testUserId)
        .get();

      expect(snapshot.size).toBe(3);
      const actions = snapshot.docs.map(doc => doc.data().action).sort();
      expect(actions).toEqual(['create', 'delete', 'update']);
    });

    it('should apply context to all entries', async () => {
      const entries: Omit<import('../src/audit/auditLog').AuditLogEntry, 'timestamp'>[] = [
        { userId: testUserId, action: 'create', entityType: 'user', entityId: 'e1' },
        { userId: testUserId, action: 'update', entityType: 'user', entityId: 'e2' },
      ];
      const context = { correlationId: 'batch-corr-456' };

      await logActionBatch(entries, context);

      const snapshot = await db.collection(COLLECTIONS.AUDIT_LOGS)
        .where('userId', '==', testUserId)
        .get();

      snapshot.docs.forEach(doc => {
        expect(doc.data().metadata).toMatchObject({ correlationId: 'batch-corr-456' });
      });
    });
  });

  describe('logActionInTransaction', () => {
    it('should create audit log entry within a transaction', async () => {
      await db.runTransaction(async (transaction) => {
        await logActionInTransaction(
          {
            userId: testUserId,
            action: testAction,
            entityType: testEntityType,
            entityId: 'transaction-test',
          },
          transaction
        );
      });

      const snapshot = await db.collection(COLLECTIONS.AUDIT_LOGS)
        .where('userId', '==', testUserId)
        .where('entityId', '==', 'transaction-test')
        .get();

      expect(snapshot.size).toBe(1);
      expect(snapshot.docs[0].data().action).toBe(testAction);
    });
  });

  describe('createAuditEntry', () => {
    it('should create audit entry object without timestamp', () => {
      const entry = createAuditEntry(
        testUserId,
        testAction,
        testEntityType,
        testEntityId,
        { old: 'value' },
        { new: 'value' },
        { source: 'test' }
      );

      expect(entry.userId).toBe(testUserId);
      expect(entry.action).toBe(testAction);
      expect(entry.entityType).toBe(testEntityType);
      expect(entry.entityId).toBe(testEntityId);
      expect(entry.originalValue).toEqual({ old: 'value' });
      expect(entry.newValue).toEqual({ new: 'value' });
      expect(entry.metadata).toEqual({ source: 'test' });
      expect(entry).not.toHaveProperty('timestamp');
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs for an entity', async () => {
      await logAction({
        userId: testUserId,
        action: 'create',
        entityType: 'task',
        entityId: 'task-1',
      });
      await logAction({
        userId: testUserId,
        action: 'update',
        entityType: 'task',
        entityId: 'task-1',
      });

      const logs = await getAuditLogs('task', 'task-1', 10);

      expect(logs.length).toBe(2);
      expect(logs[0].action).toBe('update');
      expect(logs[1].action).toBe('create');
    });

    it('should respect limit parameter', async () => {
      // Create test data specifically for this test
      await logAction({
        userId: testUserId,
        action: 'create',
        entityType: 'task',
        entityId: 'task-limit-test',
      });
      await logAction({
        userId: testUserId,
        action: 'update',
        entityType: 'task',
        entityId: 'task-limit-test',
      });

      const logs = await getAuditLogs('task', 'task-limit-test', 1);
      expect(logs.length).toBe(1);
    });

    it('should return empty array for non-existent entity', async () => {
      const logs = await getAuditLogs('task', 'non-existent', 10);
      expect(logs).toEqual([]);
    });
  });

  describe('getUserAuditLogs', () => {
    it('should retrieve audit logs for a user', async () => {
      await logAction({
        userId: testUserId,
        action: 'create',
        entityType: 'document',
        entityId: 'doc-1',
      });

      const logs = await getUserAuditLogs(testUserId, 10);

      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].userId).toBe(testUserId);
    });

    it('should respect limit parameter', async () => {
      // Create test data specifically for this test
      await logAction({
        userId: testUserId,
        action: 'create',
        entityType: 'document',
        entityId: 'doc-limit-1',
      });
      await logAction({
        userId: testUserId,
        action: 'update',
        entityType: 'document',
        entityId: 'doc-limit-2',
      });

      const logs = await getUserAuditLogs(testUserId, 1);
      expect(logs.length).toBe(1);
    });

    it('should return empty array for user with no logs', async () => {
      const logs = await getUserAuditLogs('non-existent-user', 10);
      expect(logs).toEqual([]);
    });
  });
});