import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { getAdminDb, COLLECTIONS } from '../config';
import { logAction } from '../audit/auditLog';
import { Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

export interface SendFCMRequest {
  tokens?: string[];
  topic?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  image?: string;
  priority?: 'high' | 'normal';
  ttl?: number;
}

export interface SendFCMResponse {
  success: boolean;
  results: { success: number; failure: number };
  messageIds: string[];
}

export async function sendFCMNotificationHandler(
  request: CallableRequest<SendFCMRequest>
): Promise<SendFCMResponse> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const callerUid = request.auth.uid;

  const {
    tokens,
    topic,
    title,
    body: notificationBody,
    data,
    image,
    priority = 'high',
    ttl = 2419200,
  } = request.data;

  if (!title || !notificationBody) {
    throw new HttpsError('invalid-argument', 'title and body are required');
  }
  if (!tokens?.length && !topic) {
    throw new HttpsError('invalid-argument', 'Either tokens[] or topic is required');
  }
  if (tokens && tokens.length > 500) {
    throw new HttpsError('invalid-argument', 'Maximum 500 tokens per request');
  }

  const db = getAdminDb();

  const idempotencyKey = data?.idempotencyKey;
  if (idempotencyKey) {
    const existing = await db.collection(COLLECTIONS.AUDIT_LOGS)
      .where('metadata.idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();
    if (!existing.empty) {
      return { success: true, results: { success: 0, failure: 0 }, messageIds: [] };
    }
  }

  const messaging = getMessaging();
  const messageIds: string[] = [];
  let successCount = 0;
  let failureCount = 0;

  const baseMessage = {
    notification: { title, body: notificationBody, image },
    data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
    android: { priority: priority as 'high' | 'normal', ttl },
    webpush: { headers: { TTL: String(ttl) } },
  };

  if (tokens && tokens.length > 0) {
    for (const token of tokens) {
      try {
        const messageId = await messaging.send({
          ...baseMessage,
          token,
        });
        successCount++;
        messageIds.push(messageId);
      } catch (error) {
        failureCount++;
        console.error(`FCM send failed for token:`, error);
      }
    }
  } else if (topic) {
    try {
      const messageId = await messaging.send({
        ...baseMessage,
        topic,
      });
      successCount = 1;
      messageIds.push(messageId);
    } catch (error) {
      failureCount = 1;
      console.error(`FCM topic send failed:`, error);
    }
  }

  const now = Date.now();
  await logAction({
    userId: callerUid,
    action: 'create',
    entityType: 'notification',
    entityId: idempotencyKey || `fcm_${now}`,
    newValue: { tokens: tokens?.length || 0, topic, title, priority },
    metadata: { via: 'sendFCMNotification', idempotencyKey },
  });

  if (idempotencyKey) {
    await db.collection(COLLECTIONS.AUDIT_LOGS).doc(`idempotency_${idempotencyKey}`).set({
      key: idempotencyKey,
      createdAt: Timestamp.fromMillis(now),
    });
  }

  return {
    success: true,
    results: { success: successCount, failure: failureCount },
    messageIds,
  };
}
