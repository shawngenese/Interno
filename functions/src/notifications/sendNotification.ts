import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { getAdminDb, getAdminAuth, COLLECTIONS } from '../config';
import { getMessaging } from 'firebase-admin/messaging';

export interface SendNotificationRequest {
  targetUserId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface SendNotificationResponse {
  inAppCreated: boolean;
  pushAttempted: boolean;
  pushSuccess: number;
  pushFailure: number;
}

const NOTIFICATION_TYPES = [
  'task_created',
  'task_updated',
  'task_due_soon',
  'task_overdue',
  'task_approved',
  'task_returned',
  'dtr_pending',
  'dtr_approved',
  'dtr_rejected',
  'document_pending',
  'document_approved',
  'document_rejected',
  'attendance_missing',
  'qr_generated',
  'leave_requested',
  'leave_approved',
  'leave_rejected',
  'system_announcement',
  'other',
] as const;

const NOTIFICATION_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

const STAFF_ROLES = ['admin', 'supervisor', 'coordinator'] as const;
const TRAINEE_TARGET_ROLES = ['admin', 'supervisor', 'coordinator'] as const;

const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 1000;
const MAX_DATA_KEYS = 10;
const MAX_DATA_VALUE_LENGTH = 500;

function assertField(
  value: unknown,
  field: string,
  minLength: number,
  maxLength: number
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length < minLength ||
    value.length > maxLength
  ) {
    throw new HttpsError(
      'invalid-argument',
      `Invalid ${field}: must be a string of ${minLength}-${maxLength} characters`
    );
  }
  return value;
}

function validateData(data: unknown): Record<string, string> {
  if (data === undefined) return {};
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new HttpsError('invalid-argument', 'data must be an object of string values');
  }
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length > MAX_DATA_KEYS) {
    throw new HttpsError('invalid-argument', `data must have at most ${MAX_DATA_KEYS} keys`);
  }
  for (const [key, value] of entries) {
    if (typeof value !== 'string' || value.length > MAX_DATA_VALUE_LENGTH) {
      throw new HttpsError(
        'invalid-argument',
        `data.${key} must be a string of at most ${MAX_DATA_VALUE_LENGTH} characters`
      );
    }
  }
  return data as Record<string, string>;
}

function isInQuietHours(quietStart: string, quietEnd: string, now: Date): boolean {
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = quietStart.split(':').map(Number);
  const [endH, endM] = quietEnd.split(':').map(Number);
  if (
    !Number.isFinite(startH) ||
    !Number.isFinite(startM) ||
    !Number.isFinite(endH) ||
    !Number.isFinite(endM)
  ) {
    return false;
  }
  const startTime = startH * 60 + startM;
  const endTime = endH * 60 + endM;
  return startTime > endTime
    ? currentTime >= startTime || currentTime < endTime
    : currentTime >= startTime && currentTime < endTime;
}

export async function sendNotificationHandler(
  request: CallableRequest<SendNotificationRequest>
): Promise<SendNotificationResponse> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const callerUid = request.auth.uid;
  const callerRole = (request.auth.token as Record<string, unknown>).role;

  const data = request.data ?? ({} as SendNotificationRequest);
  const targetUserId = assertField(data.targetUserId, 'targetUserId', 1, 128);
  const type = assertField(data.type, 'type', 1, 64);
  const title = assertField(data.title, 'title', 1, MAX_TITLE_LENGTH);
  const body = assertField(data.body, 'body', 1, MAX_BODY_LENGTH);
  const priority = data.priority ?? 'normal';
  const payloadData = validateData(data.data);

  if (!(NOTIFICATION_TYPES as readonly string[]).includes(type)) {
    throw new HttpsError('invalid-argument', `Unknown notification type: ${type}`);
  }
  if (!(NOTIFICATION_PRIORITIES as readonly string[]).includes(priority)) {
    throw new HttpsError('invalid-argument', `Unknown priority: ${priority}`);
  }

  if (typeof callerRole !== 'string' || callerRole.length === 0) {
    throw new HttpsError('permission-denied', 'Caller has no assigned role');
  }

  if (!(STAFF_ROLES as readonly string[]).includes(callerRole)) {
    if (callerRole !== 'trainee') {
      throw new HttpsError('permission-denied', 'Unknown caller role');
    }
    let targetRole: unknown;
    try {
      const targetUser = await getAdminAuth().getUser(targetUserId);
      targetRole = targetUser.customClaims?.role;
    } catch {
      throw new HttpsError('permission-denied', 'Target user not found');
    }
    if (!(TRAINEE_TARGET_ROLES as readonly string[]).includes(String(targetRole))) {
      throw new HttpsError(
        'permission-denied',
        'Trainees may only notify supervisors, coordinators, or admins'
      );
    }
  }

  const db = getAdminDb();

  let sendInApp = true;
  let sendFcm = true;
  const prefsSnap = await db
    .collection(COLLECTIONS.NOTIFICATION_PREFERENCES)
    .where('userId', '==', targetUserId)
    .limit(1)
    .get();

  if (!prefsSnap.empty) {
    const prefs = prefsSnap.docs[0].data();
    const typePrefs = (prefs.types as Record<string, { fcm?: boolean; inApp?: boolean }> | undefined)?.[
      type
    ];
    sendInApp = prefs.inAppEnabled !== false && typePrefs?.inApp !== false;
    sendFcm = prefs.fcmEnabled !== false && typePrefs?.fcm !== false;
    if (prefs.quietHoursStart && prefs.quietHoursEnd && isInQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd, new Date())) {
      if (priority !== 'urgent') {
        sendFcm = false;
      }
    }
  }

  let inAppCreated = false;
  if (sendInApp) {
    const now = Date.now();
    await db.collection(COLLECTIONS.NOTIFICATIONS).add({
      userId: targetUserId,
      type,
      title,
      body,
      data: payloadData,
      priority,
      read: false,
      sentVia: sendFcm ? 'both' : 'in_app',
      createdAt: now,
      updatedAt: now,
    });
    inAppCreated = true;
  }

  let pushAttempted = false;
  let pushSuccess = 0;
  let pushFailure = 0;
  let tokensForPush: string[] = [];

  if (sendFcm) {
    try {
      const tokensSnap = await db
        .collection(COLLECTIONS.FCM_TOKENS)
        .where('userId', '==', targetUserId)
        .where('active', '==', true)
        .get();

      const tokenDocs = tokensSnap.docs.filter((d) => typeof d.data().token === 'string');
      if (tokenDocs.length > 0) {
        pushAttempted = true;
        tokensForPush = tokenDocs.map((d) => d.data().token as string);

        const messaging = getMessaging();
        const res = await messaging.sendEachForMulticast({
          notification: { title, body },
          data: payloadData,
          tokens: tokensForPush,
        });
        pushSuccess = res.successCount;
        pushFailure = res.failureCount;

        const staleIndexes = res.responses
          .map((r, i) =>
            !r.success &&
            (r.error?.code === 'messaging/registration-token-not-registered' ||
              r.error?.code === 'messaging/invalid-registration-token')
              ? i
              : -1
          )
          .filter((i) => i >= 0);
        if (staleIndexes.length > 0) {
          const batch = db.batch();
          for (const i of staleIndexes) {
            batch.update(tokenDocs[i].ref, { active: false, updatedAt: Date.now() });
          }
          await batch.commit();
        }
      }
    } catch (err) {
      console.error('sendNotification: FCM send failed (in-app already saved):', err);
      pushFailure = tokensForPush.length;
    }
  }

  console.log(`sendNotification: from=${callerUid} to=${targetUserId} type=${type}`);

  return { inAppCreated, pushAttempted, pushSuccess, pushFailure };
}
