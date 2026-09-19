import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { getAdminDb, COLLECTIONS } from '../config';
import { logAction } from '../audit/auditLog';
import { Timestamp } from 'firebase-admin/firestore';

export interface ApproveDTRRequest {
  dtrId: string;
  notes?: string;
}

export interface ApproveDTRResponse {
  success: boolean;
  dtrId: string;
}

export async function approveDTRHandler(
  request: CallableRequest<ApproveDTRRequest>
): Promise<ApproveDTRResponse> {
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
    throw new HttpsError('permission-denied', 'Only supervisors or admins can approve DTRs');
  }

  const { dtrId, notes } = request.data;
  if (!dtrId) {
    throw new HttpsError('invalid-argument', 'dtrId is required');
  }

  const db = getAdminDb();

  // Verify DTR exists and belongs to caller's company
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

  // Supervisor must be assigned to the trainee
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
    status: 'approved',
    approvedAt: now,
    approvedBy: callerUid,
    approvalNotes: notes || null,
    updatedAt: now,
  });

  await logAction({
    userId: callerUid,
    action: 'dtr_approve',
    entityType: 'dtr',
    entityId: dtrId,
    originalValue: { status: originalStatus, traineeId: dtrData.traineeId },
    newValue: { status: 'approved', approvedAt: now, approvedBy: callerUid },
    metadata: { via: 'approveDTR', notes: notes || null },
  });

  return { success: true, dtrId };
}
