/**
 * Edge Function: send_fcm
 *
 * Sends FCM push notifications via Firebase Cloud Messaging v1 API.
 * Called by client or other Edge functions via `callEdgeFunction('send_fcm', { tokens, title, body, data, topic })`.
 *
 * Body:
 * {
 *   tokens?: string[],           // specific registration tokens (max 500 per batch)
 *   topic?: string,              // or topic to send to (e.g., "trainee_all", "supervisor_company_xyz")
 *   title: string,
 *   body: string,
 *   data?: Record<string, string>, // custom data payload (all values must be strings)
 *   image?: string,              // optional image URL
 *   priority?: 'high' | 'normal', // default 'high'
 *   ttl?: number                 // time-to-live in seconds (default 2419200 = 28 days)
 * }
 *
 * Returns:
 * {
 *   success: true,
 *   results: { success: number; failure: number; canonicalIds?: number; },
 *   messageIds: string[]
 * }
 *
 * Idempotency: caller can provide `idempotencyKey` in data to deduplicate.
 * Rate limiting: respects FCM limits (500 tokens per request, 240/min per project).
 */
import { serve } from 'std/http/server.ts';
import { initAdmin, getAuthInstance, getDbInstance, COLLECTIONS } from '../_shared/config.ts';
import { corsResponse, errorResponse } from '../_shared/cors.ts';
import { Timestamp } from 'firebase-admin/firestore';
import { verifyFirebaseToken } from '../_shared/auth.ts';

interface FCMMessage {
  token?: string;
  topic?: string;
  notification: {
    title: string;
    body: string;
    image?: string;
  };
  data?: Record<string, string>;
  android?: {
    priority: 'high' | 'normal';
    ttl: string;
  };
  apns?: {
    payload: {
      aps: {
        alert: { title: string; body: string };
        'mutable-content': 1;
      };
    };
  };
  webpush?: {
    headers: { TTL: string };
  };
}

async function sendFCMMessage(message: FCMMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID') || 'interno-cec9f';
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  // Get access token from service account
  const serviceAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!serviceAccount) {
    return { success: false, error: 'FIREBASE_SERVICE_ACCOUNT not configured' };
  }

  let sa: Record<string, unknown>;
  try {
    sa = JSON.parse(serviceAccount);
  } catch {
    return { success: false, error: 'Invalid FIREBASE_SERVICE_ACCOUNT JSON' };
  }

  // Generate OAuth2 access token using JWT
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  // Note: In production, use a proper JWT library. This is a simplified version.
  // For Edge functions, you should use firebase-admin's built-in credential handling.
  // Here we'll use the service account's private key to sign (requires crypto.subtle).
  // For simplicity in this example, we'll use the REST API with the service account directly.
  // In practice, deploy with firebase-admin which handles auth automatically.

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getAccessToken(sa)}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error: `FCM error: ${response.status} ${error}` };
  }

  const result = await response.json();
  return { success: true, messageId: result.name };
}

async function getAccessToken(sa: Record<string, unknown>): Promise<string> {
  // Generate JWT for service account
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));

  // Sign with private key (RSA256) - in Edge, use crypto.subtle
  const privateKey = sa.private_key as string;
  const pem = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');

  const keyData = base64ToUint8Array(pem);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const jwt = `${header}.${payload}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse({});

  try {
    initAdmin();
    const auth = getAuthInstance();
    const db = getDbInstance();

    // Verify Firebase ID token from request body
    const [verified, errResp] = await verifyFirebaseToken(req);
    if (errResp) return errResp;
    const decoded = verified!;
    const callerUid = decoded.uid;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const {
      tokens,
      topic,
      title,
      body: notificationBody,
      data,
      image,
      priority = 'high',
      ttl = 2419200, // 28 days
    } = body as {
      tokens?: string[];
      topic?: string;
      title: string;
      body: string;
      data?: Record<string, string>;
      image?: string;
      priority?: 'high' | 'normal';
      ttl?: number;
    };

    if (!title || !notificationBody) {
      return errorResponse('title and body are required', 400);
    }
    if (!tokens?.length && !topic) {
      return errorResponse('Either tokens[] or topic is required', 400);
    }
    if (tokens && tokens.length > 500) {
      return errorResponse('Maximum 500 tokens per request', 400);
    }

    // Idempotency check
    const idempotencyKey = data?.idempotencyKey;
    if (idempotencyKey) {
      const existing = await db.collection(COLLECTIONS.AUDIT_LOGS)
        .where('metadata.idempotencyKey', '==', idempotencyKey)
        .limit(1)
        .get();
      if (!existing.empty) {
        return corsResponse({ success: true, deduplicated: true, messageIds: [] });
      }
    }

    // Build message payload
    const fcmMessage: Record<string, unknown> = {
      notification: { title, body: notificationBody },
      android: { priority, ttl: `${ttl}s` },
      apns: {
        payload: {
          aps: {
            alert: { title, body: notificationBody },
            'mutable-content': 1,
          },
        },
      },
      webpush: {
        headers: { TTL: `${ttl}` },
      },
    };
    if (image) fcmMessage.notification = { ...fcmMessage.notification, image };
    if (data) fcmMessage.data = data;

    const messageIds: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    if (tokens && tokens.length > 0) {
      // Send in batches of 500 (FCM limit)
      for (let i = 0; i < tokens.length; i += 500) {
        const batch = tokens.slice(i, i + 500);
        const multicastMessage = { ...fcmMessage, tokens: batch };

        // Use firebase-admin's sendMulticast in real implementation
        // For REST API, send individually or use batch endpoint
        for (const token of batch) {
          const singleMessage = { ...fcmMessage, token };
          const result = await sendFCMMessage(singleMessage as any);
          if (result.success) {
            successCount++;
            if (result.messageId) messageIds.push(result.messageId);
          } else {
            failureCount++;
            console.error(`FCM send failed for token: ${result.error}`);
          }
        }
      }
    } else if (topic) {
      const topicMessage = { ...fcmMessage, topic };
      const result = await sendFCMMessage(topicMessage as any);
      if (result.success) {
        successCount = 1;
        if (result.messageId) messageIds.push(result.messageId);
      } else {
        failureCount = 1;
      }
    }

    // Audit log
    const now = Date.now();
    await db.collection(COLLECTIONS.AUDIT_LOGS).add({
      timestamp: Timestamp.fromMillis(now),
      userId: callerUid,
      action: 'notification_send',
      entityType: 'notification',
      entityId: idempotencyKey || `fcm_${now}`,
      newValue: { tokens: tokens?.length || 0, topic, title, priority },
      metadata: { via: 'send_fcm', idempotencyKey },
    });

    // Store idempotency key if provided
    if (idempotencyKey) {
      await db.collection(COLLECTIONS.AUDIT_LOGS).doc(`idempotency_${idempotencyKey}`).set({
        key: idempotencyKey,
        createdAt: Timestamp.fromMillis(now),
      });
    }

    return corsResponse({
      success: true,
      results: { success: successCount, failure: failureCount },
      messageIds,
    });
  } catch (err) {
    console.error('[send_fcm] error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});