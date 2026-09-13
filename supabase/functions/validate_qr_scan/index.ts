/**
 * Edge Function: validate_qr_scan
 *
 * Validates a scanned QR token and records attendance atomically.
 * Called by trainee mobile scanner via `callEdgeFunction('validate_qr_scan', { token, deviceInfo })`.
 *
 * Body:
 * {
 *   token: string,           // JWT from QR code
 *   deviceInfo?: {
 *     platform: string,
 *     userAgent: string,
 *     screenWidth?: number,
 *     screenHeight?: number,
 *   },
 *   location?: {             // optional, from Geolocation API
 *     latitude: number,
 *     longitude: number,
 *     accuracy?: number,
 *   }
 * }
 *
 * Returns:
 * {
 *   success: true,
 *   action: 'time_in' | 'time_out',
 *   timestamp: number,       // epoch ms (server time)
 *   attendanceId: string,    // Firestore attendance_records document ID
 *   message: string,         // human-readable result
 * }
 *
 * Validation steps (all must pass):
 * 1. JWT signature valid (HS256, QR_JWT_SECRET)
 * 2. Token not expired (exp > now)
 * 3. Token matches a qr_sessions document (tokenHash match)
 * 4. Session not already used (used == false)
 * 5. Session companyId matches trainee's company (via users doc)
 * 6. Business rules:
 *    - time_out requires prior time_in today (no duplicate time_in)
 *    - Cannot time_out before time_in
 * 7. Transaction: mark session used + create attendance_records + audit log
 */
import { serve } from 'std/http/server.ts';
import { initAdmin, getAuthInstance, getDbInstance, QR_ACTIONS, COLLECTIONS, AUDIT_ACTIONS } from '../_shared/config.ts';
import { Timestamp, FieldValue } from 'npm:firebase-admin/firestore@12.7.0';
import { jwtVerify } from 'npm:jose@5.9.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

function corsResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status: number) {
  return corsResponse({ error: message }, status);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function getTodayRange(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 24 * 60 * 60 * 1000 - 1;
  return { start, end };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse({});

  try {
    initAdmin();
    const auth = getAuthInstance();
    const db = getDbInstance();

    // Verify Firebase ID token (trainee)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Missing or invalid Authorization header', 401);
    }
    const idToken = authHeader.slice(7);
    const decoded = await auth.verifyIdToken(idToken);
    const traineeUid = decoded.uid;
    const traineeRole = (decoded as Record<string, unknown>).role as string | undefined;

    if (traineeRole !== 'trainee') {
      return errorResponse('Only trainees can scan QR for attendance', 403);
    }

    // Get trainee's companyId from users doc (claims may be stale)
    const userSnap = await db.doc(COLLECTIONS.USERS + '/' + traineeUid).get();
    if (!userSnap.exists()) {
      return errorResponse('User profile not found', 404);
    }
    const userData = userSnap.data() as Record<string, unknown>;
    const traineeCompanyId = userData.companyId as string | undefined;
    if (!traineeCompanyId) {
      return errorResponse('User missing companyId', 400);
    }

    // Get trainee document to find traineeId
    const traineeSnap = await db.collection(COLLECTIONS.TRAINEES)
      .where('userId', '==', traineeUid)
      .limit(1)
      .get();
    if (traineeSnap.empty) {
      return errorResponse('Trainee profile not found', 404);
    }
    const traineeDoc = traineeSnap.docs[0];
    const traineeId = traineeDoc.id;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { token, deviceInfo, location } = body as {
      token: string;
      deviceInfo?: Record<string, unknown>;
      location?: { latitude: number; longitude: number; accuracy?: number };
    };

    if (!token || typeof token !== 'string') {
      return errorResponse('token is required', 400);
    }

    // Verify JWT signature
    const jwtSecret = Deno.env.get('QR_JWT_SECRET');
    if (!jwtSecret) {
      return errorResponse('QR_JWT_SECRET not configured', 500);
    }
    const secretKey = new TextEncoder().encode(jwtSecret);

    let payload: Record<string, unknown>;
    try {
      const { payload: verified } = await jwtVerify(token, secretKey);
      payload = verified as Record<string, unknown>;
    } catch {
      // Log failed scan attempt
      await db.collection(COLLECTIONS.AUDIT_LOGS).add({
        timestamp: Timestamp.now(),
        userId: traineeUid,
        action: 'scan',
        entityType: 'qr_session',
        entityId: 'invalid',
        newValue: { reason: 'invalid_signature', traineeId },
      });
      return errorResponse('Invalid or tampered QR token', 400);
    }

    const { companyId, action, exp, nonce } = payload as {
      companyId: string;
      action: 'time_in' | 'time_out';
      exp: number;
      nonce: string;
    };

    if (!QR_ACTIONS.includes(action)) {
      return errorResponse(`Invalid action in token: ${action}`, 400);
    }

    // Check expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (exp < nowSec) {
      await db.collection(COLLECTIONS.AUDIT_LOGS).add({
        timestamp: Timestamp.now(),
        userId: traineeUid,
        action: 'scan',
        entityType: 'qr_session',
        entityId: 'expired',
        newValue: { reason: 'expired', exp, traineeId },
      });
      return errorResponse('QR token has expired', 400);
    }

    // Company match
    if (companyId !== traineeCompanyId) {
      await db.collection(COLLECTIONS.AUDIT_LOGS).add({
        timestamp: Timestamp.now(),
        userId: traineeUid,
        action: 'scan',
        entityType: 'qr_session',
        entityId: 'company_mismatch',
        newValue: { reason: 'company_mismatch', tokenCompany: companyId, userCompany: traineeCompanyId, traineeId },
      });
      return errorResponse('QR token not valid for your company', 403);
    }

    // Find matching session by tokenHash
    const tokenHash = await sha256Hex(token);
    const sessionsSnap = await db.collection(COLLECTIONS.QR_SESSIONS)
      .where('tokenHash', '==', tokenHash)
      .where('used', '==', false)
      .limit(1)
      .get();

    if (sessionsSnap.empty) {
      await db.collection(COLLECTIONS.AUDIT_LOGS).add({
        timestamp: Timestamp.now(),
        userId: traineeUid,
        action: 'scan',
        entityType: 'qr_session',
        entityId: 'not_found_or_used',
        newValue: { reason: 'not_found_or_already_used', nonce, traineeId },
      });
      return errorResponse('QR token not found or already used', 400);
    }

    const sessionDoc = sessionsSnap.docs[0];
    const sessionData = sessionDoc.data();
    const sessionId = sessionDoc.id;

    // Additional session validation
    if (sessionData.companyId !== companyId || sessionData.action !== action) {
      return errorResponse('QR token mismatch', 400);
    }
    if (sessionData.used) {
      return errorResponse('QR token already used', 400);
    }
    if (sessionData.expiresAt < Date.now()) {
      return errorResponse('QR token expired', 400);
    }

    // Business rules check (today's attendance)
    const { start: dayStart, end: dayEnd } = getTodayRange();
    const todayAttendance = await db.collection(COLLECTIONS.ATTENDANCE_RECORDS)
      .where('traineeId', '==', traineeId)
      .where('timestamp', '>=', dayStart)
      .where('timestamp', '<=', dayEnd)
      .get();

    const hasTimeIn = todayAttendance.docs.some((d) => d.data().type === 'time_in');
    const hasTimeOut = todayAttendance.docs.some((d) => d.data().type === 'time_out');

    if (action === 'time_in' && hasTimeIn) {
      return errorResponse('Already timed in today', 400);
    }
    if (action === 'time_out') {
      if (!hasTimeIn) {
        return errorResponse('Must time in before timing out', 400);
      }
      if (hasTimeOut) {
        return errorResponse('Already timed out today', 400);
      }
    }

    // All validations passed — atomic transaction
    const now = Date.now();
    const attendanceRef = db.collection(COLLECTIONS.ATTENDANCE_RECORDS).doc();

    await db.runTransaction(async (tx) => {
      // 1. Mark QR session as used
      tx.update(sessionDoc.ref, { used: true, usedAt: now, usedBy: traineeUid });

      // 2. Create attendance record
      tx.set(attendanceRef, {
        traineeId,
        type: action,
        timestamp: now,
        qrSessionId: sessionId,
        deviceInfo: deviceInfo ?? null,
        location: location ?? null,
        createdAt: Timestamp.fromMillis(now),
      });

      // 3. Audit log for scan
      tx.set(db.collection(COLLECTIONS.AUDIT_LOGS).doc(), {
        timestamp: Timestamp.fromMillis(now),
        userId: traineeUid,
        action: 'scan',
        entityType: 'attendance_record',
        entityId: attendanceRef.id,
        originalValue: null,
        newValue: { action, qrSessionId: sessionId, traineeId, deviceInfo, location },
        metadata: { via: 'validate_qr_scan' },
      });
    });

    const actionLabel = action === 'time_in' ? 'Time In' : 'Time Out';
    return corsResponse({
      success: true,
      action,
      timestamp: now,
      attendanceId: attendanceRef.id,
      message: `${actionLabel} recorded successfully`,
    });
  } catch (err) {
    console.error('[validate_qr_scan] error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});