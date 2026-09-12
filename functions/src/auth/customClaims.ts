import { getAdminAuth, ROLES, type UserRole, type AuditAction } from '../config';
import { logAction } from '../audit/auditLog';
import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';

const adminAuth = getAdminAuth();

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
  const callerRole = callerClaims.role as UserRole | undefined;

  if (callerRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can assign roles');
  }

  try {
    const userRecord = await adminAuth.getUser(uid);

    const customClaims: Record<string, unknown> = {
      role,
      updatedAt: Date.now(),
    };

    if (companyId) customClaims.companyId = companyId;
    if (departmentId) customClaims.departmentId = departmentId;
    if (supervisorId) customClaims.supervisorId = supervisorId;
    if (traineeId) customClaims.traineeId = traineeId;

    await adminAuth.setCustomUserClaims(uid, customClaims);

    await logAction(
      {
        userId: request.auth.uid,
        action: 'role_change' as AuditAction,
        entityType: 'user',
        entityId: uid,
        originalValue: { role: userRecord.customClaims?.role },
        newValue: { role, companyId, departmentId, supervisorId, traineeId },
      },
      { correlationId: request.rawRequest.headers['x-correlation-id'] as string }
    );

    return { success: true, role };
  } catch (error) {
    console.error('Error setting user role:', error);
    throw new HttpsError('internal', 'Failed to set user role');
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
  await adminAuth.revokeRefreshTokens(uid);
}

export async function deleteUserAccount(uid: string): Promise<void> {
  await adminAuth.deleteUser(uid);
}

export async function getUserByEmail(email: string) {
  return adminAuth.getUserByEmail(email);
}

export async function listUsers(maxResults = 1000) {
  return adminAuth.listUsers(maxResults);
}