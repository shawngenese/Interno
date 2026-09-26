import { sendNotificationHandler, type SendNotificationRequest } from '../src/notifications/sendNotification';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { getAdminDb, getAdminAuth, COLLECTIONS } from '../src/config';
import { getMessaging } from 'firebase-admin/messaging';

jest.mock('../src/config', () => ({
  COLLECTIONS: {
    NOTIFICATIONS: 'notifications',
    NOTIFICATION_PREFERENCES: 'notification_preferences',
    FCM_TOKENS: 'fcm_tokens',
  },
  getAdminDb: jest.fn(),
  getAdminAuth: jest.fn(),
}));

jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(),
}));

const mockAuth = {
  getUser: jest.fn(),
};

const mockSendEachForMulticast = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockAdd = jest.fn();

function makeDb(opts: {
  prefs?: Record<string, unknown>;
  tokens?: string[];
}): void {
  const db = {
    collection: (name: string) => {
      if (name === COLLECTIONS.NOTIFICATION_PREFERENCES) {
        return {
          where: () => ({
            limit: () => ({
              get: async () => ({
                empty: opts.prefs === undefined,
                docs:
                  opts.prefs === undefined
                    ? []
                    : [{ data: () => opts.prefs }],
              }),
            }),
          }),
        };
      }
      if (name === COLLECTIONS.NOTIFICATIONS) {
        return { add: mockAdd };
      }
      if (name === COLLECTIONS.FCM_TOKENS) {
        return {
          where: () => ({
            where: () => ({
              get: async () => ({
                docs: (opts.tokens ?? []).map((token, i) => ({
                  data: () => ({ token, userId: 'target-uid', active: true }),
                  ref: { id: `token-ref-${i}` },
                })),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    },
    batch: () => ({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    }),
  };
  (getAdminDb as unknown as jest.Mock).mockReturnValue(db);
}

function makeRequest(
  data: Partial<SendNotificationRequest>,
  auth?: { uid: string; token: Record<string, unknown> }
): CallableRequest<SendNotificationRequest> {
  return {
    data,
    auth,
    rawRequest: { headers: {} },
  } as unknown as CallableRequest<SendNotificationRequest>;
}

function baseData(overrides: Partial<SendNotificationRequest> = {}): Partial<SendNotificationRequest> {
  return {
    targetUserId: 'target-uid',
    type: 'task_created',
    title: 'New Task Assigned',
    body: 'You have a new task: Demo',
    ...overrides,
  };
}

async function expectError(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
    throw new Error('expected promise to reject');
  } catch (err) {
    const e = err as { code?: string };
    expect(e.code).toBe(code);
  }
}

describe('sendNotificationHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2026-01-01T23:30:00') });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (getAdminAuth as unknown as jest.Mock).mockReturnValue(mockAuth);
    (getMessaging as unknown as jest.Mock).mockReturnValue({
      sendEachForMulticast: mockSendEachForMulticast,
    });
    mockAdd.mockResolvedValue({ id: 'notif-1' });
    mockBatchUpdate.mockResolvedValue(undefined);
    mockBatchCommit.mockResolvedValue(undefined);
    mockAuth.getUser.mockResolvedValue({ uid: 'target-uid', customClaims: { role: 'supervisor' } });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects unauthenticated callers', async () => {
    await expectError(sendNotificationHandler(makeRequest(baseData())), 'unauthenticated');
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('rejects missing or blank targetUserId', async () => {
    const auth = { uid: 'caller', token: { role: 'admin' } };
    await expectError(sendNotificationHandler(makeRequest(baseData({ targetUserId: '' }), auth)), 'invalid-argument');
    await expectError(sendNotificationHandler(makeRequest({ type: 'task_created', title: 't', body: 'b' }, auth)), 'invalid-argument');
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('rejects unknown type and priority', async () => {
    const auth = { uid: 'caller', token: { role: 'admin' } };
    await expectError(
      sendNotificationHandler(makeRequest(baseData({ type: 'not_a_type' }), auth)),
      'invalid-argument'
    );
    await expectError(
      sendNotificationHandler(makeRequest(baseData({ priority: 'asap' as 'normal' }), auth)),
      'invalid-argument'
    );
  });

  it('rejects oversized title and body', async () => {
    const auth = { uid: 'caller', token: { role: 'admin' } };
    await expectError(
      sendNotificationHandler(makeRequest(baseData({ title: 'x'.repeat(201) }), auth)),
      'invalid-argument'
    );
    await expectError(
      sendNotificationHandler(makeRequest(baseData({ body: 'x'.repeat(1001) }), auth)),
      'invalid-argument'
    );
  });

  it('rejects callers without a role claim', async () => {
    await expectError(
      sendNotificationHandler(makeRequest(baseData(), { uid: 'caller', token: {} })),
      'permission-denied'
    );
  });

  it('blocks trainees from notifying other trainees', async () => {
    makeDb({});
    mockAuth.getUser.mockResolvedValue({ uid: 'target-uid', customClaims: { role: 'trainee' } });
    await expectError(
      sendNotificationHandler(makeRequest(baseData(), { uid: 'trainee-1', token: { role: 'trainee' } })),
      'permission-denied'
    );
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('blocks trainees from notifying unknown users', async () => {
    makeDb({});
    mockAuth.getUser.mockRejectedValue(new Error('user not found'));
    await expectError(
      sendNotificationHandler(makeRequest(baseData(), { uid: 'trainee-1', token: { role: 'trainee' } })),
      'permission-denied'
    );
  });

  it('allows trainees to notify supervisors and creates the in-app doc', async () => {
    makeDb({});
    const res = await sendNotificationHandler(
      makeRequest(baseData(), { uid: 'trainee-1', token: { role: 'trainee' } })
    );
    expect(res.inAppCreated).toBe(true);
    expect(mockAdd).toHaveBeenCalledTimes(1);
    const written = mockAdd.mock.calls[0][0];
    expect(written.userId).toBe('target-uid');
    expect(written.type).toBe('task_created');
    expect(written.read).toBe(false);
    expect(typeof written.createdAt).toBe('number');
    expect(typeof written.updatedAt).toBe('number');
  });

  it('creates a notification for admin callers without preference docs', async () => {
    makeDb({});
    const res = await sendNotificationHandler(
      makeRequest(baseData({ data: { taskId: 't-1' } }), { uid: 'admin-1', token: { role: 'admin' } })
    );
    expect(res.inAppCreated).toBe(true);
    expect(res.pushAttempted).toBe(false);
    const written = mockAdd.mock.calls[0][0];
    expect(written.data).toEqual({ taskId: 't-1' });
    expect(written.priority).toBe('normal');
  });

  it('suppresses everything when in-app and FCM are disabled in preferences', async () => {
    makeDb({ prefs: { userId: 'target-uid', inAppEnabled: false, fcmEnabled: false } });
    const res = await sendNotificationHandler(
      makeRequest(baseData(), { uid: 'admin-1', token: { role: 'admin' } })
    );
    expect(res.inAppCreated).toBe(false);
    expect(res.pushAttempted).toBe(false);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('honors per-type in-app opt-out while still allowing push', async () => {
    makeDb({
      prefs: {
        userId: 'target-uid',
        inAppEnabled: true,
        fcmEnabled: true,
        types: { task_created: { inApp: false, fcm: true, email: false } },
      },
      tokens: ['token-1'],
    });
    mockSendEachForMulticast.mockResolvedValue({ successCount: 1, failureCount: 0, responses: [{ success: true }] });
    const res = await sendNotificationHandler(
      makeRequest(baseData(), { uid: 'admin-1', token: { role: 'admin' } })
    );
    expect(res.inAppCreated).toBe(false);
    expect(res.pushAttempted).toBe(true);
    expect(res.pushSuccess).toBe(1);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('suppresses push during quiet hours for non-urgent priorities', async () => {
    makeDb({
      prefs: { userId: 'target-uid', inAppEnabled: true, fcmEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00' },
      tokens: ['token-1'],
    });
    const res = await sendNotificationHandler(
      makeRequest(baseData(), { uid: 'admin-1', token: { role: 'admin' } })
    );
    expect(res.inAppCreated).toBe(true);
    expect(res.pushAttempted).toBe(false);
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });

  it('allows urgent push during quiet hours', async () => {
    makeDb({
      prefs: { userId: 'target-uid', inAppEnabled: true, fcmEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00' },
      tokens: ['token-1'],
    });
    mockSendEachForMulticast.mockResolvedValue({ successCount: 1, failureCount: 0, responses: [{ success: true }] });
    const res = await sendNotificationHandler(
      makeRequest(baseData({ priority: 'urgent' }), { uid: 'admin-1', token: { role: 'admin' } })
    );
    expect(res.pushAttempted).toBe(true);
    expect(res.pushSuccess).toBe(1);
  });

  it('sends to active tokens and deactivates stale ones', async () => {
    makeDb({ tokens: ['good-token', 'stale-token'] });
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      ],
    });
    const res = await sendNotificationHandler(
      makeRequest(baseData(), { uid: 'admin-1', token: { role: 'admin' } })
    );
    expect(res.inAppCreated).toBe(true);
    expect(res.pushAttempted).toBe(true);
    expect(res.pushSuccess).toBe(1);
    expect(res.pushFailure).toBe(1);
    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'token-ref-1' }),
      expect.objectContaining({ active: false })
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('does not throw when FCM send fails after in-app is saved', async () => {
    makeDb({ tokens: ['token-1'] });
    mockSendEachForMulticast.mockRejectedValue(new Error('network down'));
    const res = await sendNotificationHandler(
      makeRequest(baseData(), { uid: 'admin-1', token: { role: 'admin' } })
    );
    expect(res.inAppCreated).toBe(true);
    expect(res.pushFailure).toBe(1);
    expect(console.error).toHaveBeenCalled();
  });
});
