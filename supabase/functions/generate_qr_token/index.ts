/**
 * Edge Function: generate_qr_token
 *
 * Generates a signed JWT QR token for attendance (time_in/time_out).
 * Called by supervisor UI via `callEdgeFunction('generate_qr_token', { action, expirationSeconds })`.
 *
 * Body:
 * {
 *   action: 'time_in' | 'time_out',
 *   expirationSeconds?: 30 | 60 | 120 | 300 (default 60)
 * }
 *
 * Returns:
 * {
 *   token: string,           // JWT (HS256) payload: { companyId, action, exp, nonce, iat }
 *   qrDataUrl: string,       // data:image/png;base64,... (for <img> src)
 *   expiresAt: number,       // epoch ms
 *   sessionId: string        // Firestore qr_sessions document ID
 * }
 *
 * Token payload (HS256, secret in QR_JWT_SECRET):
 * {
 *   companyId: string,       // supervisor's company
 *   action: 'time_in' | 'time_out',
 *   exp: number,             // expiration timestamp (seconds)
 *   nonce: string,           // random 16-char string
 *   iat: number              // issued at (seconds)
 * }
 *
 * One-time use: stored in qr_sessions with used=false, validated atomically.
 */
import { serve } from 'std/http/server.ts';
import { initAdmin, getAuthInstance, getDbInstance, COLLECTIONS } from '../_shared/config.ts';
import { Timestamp } from 'firebase-admin/firestore';
import { SignJWT } from 'npm:jose@5.9.0';
import { corsResponse, errorResponse } from '../_shared/cors.ts';
import { verifyFirebaseToken } from '../_shared/auth.ts';

const QR_ACTIONS = ['time_in', 'time_out'] as const;
const QR_EXPIRATION_OPTIONS = [30, 60, 120, 300] as const;

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function generateQRCodeDataUrl(token: string): Promise<string> {
  // Simple QR code using a lightweight approach - return data URL
  // In production, you might use a proper QR library. For now, we'll use
  // a simple text representation that the frontend can render with a QR library.
  const qrText = `INTERNO:${token}`;
  // We'll return the token itself; frontend renders QR via react-qr-code or similar
  return `data:text/plain,${encodeURIComponent(qrText)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse({});

  try {
    initAdmin();
    const auth = getAuthInstance();
    const db = getDbInstance();

    // Verify Firebase ID token from request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const [verified, errResp] = await verifyFirebaseToken(body);
    if (errResp) return errResp;
    const decoded = verified!;
    const callerUid = decoded.uid;
    const callerRole = (decoded as Record<string, unknown>).role as string | undefined;
    const callerCompanyId = (decoded as Record<string, unknown>).companyId as string | undefined;

    if (!callerCompanyId) {
      return errorResponse('Caller missing companyId in custom claims', 400);
    }
    if (callerRole !== 'supervisor' && callerRole !== 'admin') {
      return errorResponse('Only supervisors and admins can generate QR tokens', 403);
    }

    const { action, expirationSeconds } = body as {
      action: 'time_in' | 'time_out';
      expirationSeconds?: number;
    };

    if (!QR_ACTIONS.includes(action)) {
      return errorResponse(`Invalid action: ${action}. Must be one of: ${QR_ACTIONS.join(', ')}`, 400);
    }

    const expSeconds = QR_EXPIRATION_OPTIONS.includes(expirationSeconds as typeof QR_EXPIRATION_OPTIONS[number])
      ? (expirationSeconds as typeof QR_EXPIRATION_OPTIONS[number])
      : 60;

    // Get QR_JWT_SECRET from env
    const jwtSecret = Deno.env.get('QR_JWT_SECRET');
    if (!jwtSecret) {
      return errorResponse('QR_JWT_SECRET not configured in Edge secrets', 500);
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const exp = nowSec + expSeconds;
    const nonce = generateNonce();

    // Create JWT (HS256)
    const secretKey = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({
      companyId: callerCompanyId,
      action,
      exp,
      nonce,
      iat: nowSec,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .sign(secretKey);

    // Store session in Firestore (one-time use)
    const sessionRef = db.collection(COLLECTIONS.QR_SESSIONS).doc();
    const tokenHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(tokenHashBuf), (b) => b.toString(16).padStart(2, '0')).join('');
    await sessionRef.set({
      tokenHash,
      companyId: callerCompanyId,
      action,
      expiresAt: exp * 1000,
      createdBy: callerUid,
      used: false,
      createdAt: Timestamp.now(),
    });

    const qrDataUrl = await generateQRCodeDataUrl(token);

    // Audit log
    await db.collection(COLLECTIONS.AUDIT_LOGS).add({
      timestamp: Timestamp.now(),
      userId: callerUid,
      action: 'create',
      entityType: 'qr_session',
      entityId: sessionRef.id,
      newValue: { action, expirationSeconds: expSeconds, companyId: callerCompanyId },
    });

    return corsResponse({
      token,
      qrDataUrl,
      expiresAt: exp * 1000,
      sessionId: sessionRef.id,
    });
  } catch (err) {
    console.error('[generate_qr_token] error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});