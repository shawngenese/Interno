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
import { Timestamp } from 'firebase-admin/firestore';
import { corsResponse, errorResponse } from '../_shared/cors.ts';
import { verifyFirebaseToken } from '../_shared/auth.ts';



serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse({});

  try {
    initAdmin();
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