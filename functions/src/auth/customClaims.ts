import { getAdminAuth, ROLES, type UserRole, type AuditAction, type EntityType, getAdminDb, COLLECTIONS } from '../config';
import { logAction, deepClean } from '../audit/auditLog';
import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';

export interface SetUserRoleRequest {
  uid: string;
  role: UserRole;
  companyId?: string;
  departmentId?: string;
  supervisorId?: string;
  traineeId?: string;
}

export interface GetCurrentUserRoleResponse {
  role: UserRole | null;
  claims: Record<string, unknown>;
}

export async function setUserRoleHandler(
  request: CallableRequest<SetUserRoleRequest>
): Promise<{ success: true; role: UserRole }> {
  const { uid, role, companyId, departmentId, supervisorId, traineeId } = request.data;

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  if (!ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', `Invalid role: ${role}`);
  }

  const callerClaims = request.auth.token;
  let callerRole = callerClaims.role as UserRole | undefined;

  // Fallback: if caller token claims don't have role set yet (e.g. freshly created admin or token not refreshed),
  // check their Firestore user doc.
  if (!callerRole) {
    try {
      const callerDoc = await getAdminDb().collection(COLLECTIONS.USERS).doc(request.auth.uid).get();
      if (callerDoc.exists) {
        callerRole = callerDoc.data()?.role as UserRole | undefined;
      }
    } catch (e) {
      console.warn('Failed to fetch caller role from Firestore:', e);
    }
  }

  // Allow admins to assign any role. Coordinators can only assign the 'trainee' role.
  if (callerRole !== 'admin') {
    if (callerRole === 'coordinator' && role === 'trainee') {
      console.info('Coordinator assigning trainee role for uid', uid);
    } else {
      console.warn('Permission denied: caller role', callerRole, 'attempted to assign', role);
      throw new HttpsError('permission-denied', `Only admins can assign roles (caller role: ${callerRole || 'none'})`);
    }
  }

  const adminAuth = getAdminAuth();

  try {
    const userRecord = await adminAuth.getUser(uid);
    const existingClaims = (userRecord.customClaims || {}) as Record<string, unknown>;

    const customClaims: Record<string, unknown> = {
      ...existingClaims,
      role,
      updatedAt: Date.now(),
    };

    if (companyId !== undefined) customClaims.companyId = companyId;
    if (departmentId !== undefined) customClaims.departmentId = departmentId;
    if (supervisorId !== undefined) customClaims.supervisorId = supervisorId;
    if (traineeId !== undefined) customClaims.traineeId = traineeId;

    await adminAuth.setCustomUserClaims(uid, customClaims);

    // Audit logging is non-fatal: claims are already safely set on the user account.
    try {
      const rawPayload = {
        userId: request.auth.uid,
        action: 'role_change' as AuditAction,
        entityType: 'user' as EntityType,
        entityId: uid,
        originalValue: userRecord.customClaims && typeof userRecord.customClaims.role !== 'undefined'
          ? { role: userRecord.customClaims.role }
          : undefined,
        newValue: (() => {
          const obj: Record<string, unknown> = { role };
          if (companyId !== undefined) obj.companyId = companyId;
          if (departmentId !== undefined) obj.departmentId = departmentId;
          if (supervisorId !== undefined) obj.supervisorId = supervisorId;
          if (traineeId !== undefined) obj.traineeId = traineeId;
          return obj;
        })(),
      };

      const auditPayload = deepClean(rawPayload);
      if (auditPayload) {
        await logAction(auditPayload, { correlationId: request.rawRequest.headers['x-correlation-id'] as string });
      }
    } catch (auditErr) {
      console.warn('Audit logging failed (non-fatal, claims were set successfully):', auditErr);
    }

    return { success: true, role };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error in setUserRoleHandler:', msg, error instanceof Error ? error.stack : undefined);
    throw new HttpsError('internal', `Failed to set user role: ${msg}`);
  }
}

export async function getCurrentUserRoleHandler(
  request: CallableRequest
): Promise<GetCurrentUserRoleResponse> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const claims = request.auth.token;
  const role = claims.role as UserRole | undefined;

  return {
    role: role ?? null,
    claims,
  };
}

export async function revokeUserTokens(uid: string): Promise<void> {
  await getAdminAuth().revokeRefreshTokens(uid);
}

export async function deleteUserAccount(uid: string): Promise<void> {
  await getAdminAuth().deleteUser(uid);
}

export async function getUserByEmail(email: string) {
  return getAdminAuth().getUserByEmail(email);
}

export async function listUsers(maxResults = 1000) {
  return getAdminAuth().listUsers(maxResults);
}