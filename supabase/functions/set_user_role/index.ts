/**
 * Edge Function: set_user_role
 *
 * Called by admin UI via `callEdgeFunction('set_user_role', { uid, role, ... })`.
 * Requires caller to have `role: admin` custom claim (verified via Firebase ID token).
 *
 * Body:
 * {
 *   uid: string,
 *   role: 'admin' | 'supervisor' | 'coordinator' | 'trainee',
 *   companyId?: string,
 *   departmentId?: string,
 *   supervisorId?: string,
 *   traineeId?: string
 * }
 *
 * Returns: { success: true, role: string }
 */
import { serve } from 'std/http/server.ts';
import { initAdmin, getAuthInstance, getDbInstance, ROLES, type UserRole, COLLECTIONS } from '../_shared/config.ts';
import { corsResponse, errorResponse } from '../_shared/cors.ts';
import { Timestamp } from 'firebase-admin/firestore';
import { verifyFirebaseToken } from '../_shared/auth.ts';

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
    const callerRole = (decoded as Record<string, unknown>).role as string | undefined;
    if (callerRole !== 'admin') {
      return errorResponse('Only admins can assign roles', 403);
    }

    // Parse and validate body

    const { uid, role, companyId, departmentId, supervisorId, traineeId } = body as {
      uid: string;
      role: UserRole;
      companyId?: string;
      departmentId?: string;
      supervisorId?: string;
      traineeId?: string;
    };

    if (!uid || typeof uid !== 'string') {
      return errorResponse('uid is required', 400);
    }
    if (!ROLES.includes(role)) {
      return errorResponse(`Invalid role: ${role}. Must be one of: ${ROLES.join(', ')}`, 400);
    }

    // Fetch target user to ensure exists
    let targetUser;
    try {
      targetUser = await auth.getUser(uid);
    } catch {
      return errorResponse('User not found', 404);
    }

    // Set custom claims
    const customClaims: Record<string, unknown> = {
      role,
      updatedAt: Date.now(),
    };
    if (companyId) customClaims.companyId = companyId;
    if (departmentId) customClaims.departmentId = departmentId;
    if (supervisorId) customClaims.supervisorId = supervisorId;
    if (traineeId) customClaims.traineeId = traineeId;

    await auth.setCustomUserClaims(uid, customClaims);

    // Mirror role in users/{uid} doc (firestore.rules reads this)
    await db.doc(COLLECTIONS.USERS + '/' + uid).set(
      {
        email: targetUser.email ?? null,
        role,
        displayName: targetUser.displayName ?? (targetUser.email ? targetUser.email.split('@')[0] : 'User'),
        ...(companyId ? { companyId } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(supervisorId ? { supervisorId } : {}),
        ...(traineeId ? { traineeId } : {}),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

    // Audit log (client-write blocked; Edge bypasses rules)
    await db.collection(COLLECTIONS.AUDIT_LOGS).add({
      timestamp: Timestamp.now(),
      userId: decoded.uid,
      action: 'role_change',
      entityType: 'user',
      entityId: uid,
      originalValue: { role: targetUser.customClaims?.role ?? null },
      newValue: { role, companyId, departmentId, supervisorId, traineeId },
      metadata: { via: 'set_user_role edge' },
    });

    return corsResponse({ success: true, role });
  } catch (err) {
    console.error('[set_user_role] error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});