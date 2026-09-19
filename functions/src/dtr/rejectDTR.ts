import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { getAdminDb, COLLECTIONS } from '../config';
import { logAction } from '../audit/auditLog';

export interface RejectDTRRequest {
  dtrId: string;
  reason?: string;
}

export interface RejectDTRResponse {
  success: boolean;
  dtrId: string;
}

export async function rejectDTRHandler(
  request: CallableRequest<RejectDTRRequest>
): Promise<RejectDTRResponse> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const callerUid = request.auth.uid;
  const callerRole = request.auth.token?.role as string | undefined;
  const callerCompanyId = request.auth.token?.companyId as string | undefined;

  if (!callerCompanyId) {
    throw new HttpsError('invalid-argument', 'Caller missing companyId in custom claims');
  }
  if (!['admin', 'supervisor'].includes(callerRole ?? '')) {
    throw new HttpsError('permission-denied', 'Only supervisors or admins can reject DTRs');
  }

  const { dtrId, reason } = request.data;
  if (!dtrId) {
    throw new HttpsError('invalid-argument', 'dtrId is required');
  }

  const db = getAdminDb();

  const dtrRef = db.doc(`${COLLECTIONS.DTRS}/${dtrId}`);
  const dtrSnap = await dtrRef.get();
  if (!dtrSnap.exists) {
    throw new HttpsError('not-found', 'DTR not found');
  }
  const dtrData = dtrSnap.data()!;
  if (dtrData.companyId !== callerCompanyId) {
    throw new HttpsError('permission-denied', 'DTR does not belong to your company');
  }
  if (dtrData.status !== 'pending') {
    throw new HttpsError('failed-precondition', `DTR status is '${dtrData.status}', expected 'pending'`);
  }

  if (callerRole === 'supervisor') {
    const supSnap = await db.doc(`${COLLECTIONS.SUPERVISORS}/${callerUid}`).get();
    if (!supSnap.exists) {
      throw new HttpsError('not-found', 'Supervisor profile not found');
    }
    const assignedTrainees = supSnap.data()!.assignedTrainees as string[] | undefined;
    if (!assignedTrainees?.includes(dtrData.traineeId)) {
      throw new HttpsError('permission-denied', 'Not authorized for this trainee');
    }
  }

  const now = Date.now();
  const originalStatus = dtrData.status;

  await dtrRef.update({
    status: 'rejected',
    reviewedAt: now,
    reviewedBy: callerUid,
    rejectionReason: reason || null,
    updatedAt: now,
  });

  await logAction({
    userId: callerUid,
    action: 'dtr_reject',
    entityType: 'dtr',
    entityId: dtrId,
    originalValue: { status: originalStatus, traineeId: dtrData.traineeId },
    newValue: { status: 'rejected', reviewedAt: now, reviewedBy: callerUid },
    metadata: { via: 'rejectDTR', reason: reason || null },
  });

  return { success: true, dtrId };
}
