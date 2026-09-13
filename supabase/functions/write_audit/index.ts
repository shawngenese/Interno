/**
 * Edge Function: write_audit
 *
 * Called by client via `callEdgeFunction('write_audit', { ... })` or by other
 * Edge Functions. Writes an immutable audit log entry to Firestore.
 *
 * Body (matches AuditLogEntry minus timestamp):
 * {
 *   userId: string,
 *   action: AuditAction,
 *   entityType: EntityType,
 *   entityId: string,
 *   originalValue?: Record<string, unknown>,
 *   newValue?: Record<string, unknown>,
 *   metadata?: Record<string, unknown>
 * }
 *
 * Returns: { success: true, logId: string }
 */
import { serve } from 'std/http/server.ts';
import { initAdmin, getDbInstance, AUDIT_ACTIONS, ENTITY_TYPES, COLLECTIONS } from '../_shared/config.ts';
import { Timestamp } from 'npm:firebase-admin/firestore@12.7.0';

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse({});

  try {
    initAdmin();
    const db = getDbInstance();

    // Verify Firebase ID token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Missing or invalid Authorization header', 401);
    }
    const idToken = authHeader.slice(7);

    // Use the default app's auth to verify (initAdmin ensures it's initialized)
    const { getAuth } = await import('firebase-admin/auth');
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const callerUid = decoded.uid;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const {
      userId,
      action,
      entityType,
      entityId,
      originalValue,
      newValue,
      metadata,
    } = body as {
      userId: string;
      action: string;
      entityType: string;
      entityId: string;
      originalValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    };

    // Basic validation
    if (!userId || !action || !entityType || !entityId) {
      return errorResponse('userId, action, entityType, entityId are required', 400);
    }
    if (!AUDIT_ACTIONS.includes(action as typeof AUDIT_ACTIONS[number])) {
      return errorResponse(`Invalid action: ${action}`, 400);
    }
    if (!ENTITY_TYPES.includes(entityType as typeof ENTITY_TYPES[number])) {
      return errorResponse(`Invalid entityType: ${entityType}`, 400);
    }

    // Authorization: caller can only write for themselves unless admin
    const callerRole = (decoded as Record<string, unknown>).role as string | undefined;
    if (callerUid !== userId && callerRole !== 'admin') {
      return errorResponse('Cannot write audit log for another user', 403);
    }

    const docRef = await db.collection(COLLECTIONS.AUDIT_LOGS).add({
      timestamp: Timestamp.now(),
      userId,
      action,
      entityType,
      entityId,
      originalValue: originalValue ?? null,
      newValue: newValue ?? null,
      metadata: metadata ?? null,
    });

    return corsResponse({ success: true, logId: docRef.id });
  } catch (err) {
    console.error('[write_audit] error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});