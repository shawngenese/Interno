import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { getAdminDb, COLLECTIONS } from '../config';
import { logActionInTransaction } from '../audit/auditLog';

export interface ReviewCorrectionRequest {
  dtrId: string;
  correctionRequestId: string;
  action: 'approve' | 'reject';
  notes?: string;
}

export interface ReviewCorrectionResponse {
  success: boolean;
  correctionRequestId: string;
}

export async function reviewCorrectionRequestHandler(
  request: CallableRequest<ReviewCorrectionRequest>
): Promise<ReviewCorrectionResponse> {
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
    throw new HttpsError('permission-denied', 'Only supervisors or admins can review corrections');
  }

  const { dtrId, correctionRequestId, action, notes } = request.data;
  if (!dtrId || !correctionRequestId || !action) {
    throw new HttpsError('invalid-argument', 'dtrId, correctionRequestId, and action are required');
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

  // Verify correction request exists and is pending
  const corrRef = db.doc(`${COLLECTIONS.DTRS}/${dtrId}/correction_requests/${correctionRequestId}`);
  const corrSnap = await corrRef.get();
  if (!corrSnap.exists) {
    throw new HttpsError('not-found', 'Correction request not found');
  }
  const corrData = corrSnap.data()!;
  if (corrData.status !== 'pending') {
    throw new HttpsError('failed-precondition', `Correction request status is '${corrData.status}', expected 'pending'`);
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

  // Run both updates in a transaction for atomicity
  await db.runTransaction(async (tx) => {
    const now = Date.now();

    if (action === 'approve') {
      // Apply proposed values to DTR
      const proposed = corrData.proposedValue;
      const applied: Record<string, unknown> = {};
      if (proposed.actualTimeIn !== undefined) applied.actualTimeIn = proposed.actualTimeIn;
      if (proposed.actualTimeOut !== undefined) applied.actualTimeOut = proposed.actualTimeOut;
      if (proposed.regularMinutes !== undefined) applied.regularMinutes = proposed.regularMinutes;
      if (proposed.overtimeMinutes !== undefined) applied.overtimeMinutes = proposed.overtimeMinutes;
      if (proposed.lateMinutes !== undefined) applied.lateMinutes = proposed.lateMinutes;
      if (proposed.undertimeMinutes !== undefined) applied.undertimeMinutes = proposed.undertimeMinutes;

      tx.update(dtrRef, {
        ...applied,
        status: 'corrected',
        correctionRequestId,
        updatedAt: now,
      });

      tx.update(corrRef, {
        status: 'approved',
        reviewedBy: callerUid,
        reviewedAt: now,
        reviewNotes: notes || null,
        updatedAt: now,
      });

      await logActionInTransaction(
        {
          userId: callerUid,
          action: 'dtr_correct',
          entityType: 'dtr',
          entityId: dtrId,
          originalValue: {
            status: dtrData.status,
            traineeId: dtrData.traineeId,
            regularMinutes: dtrData.regularMinutes,
            overtimeMinutes: dtrData.overtimeMinutes,
          },
          newValue: {
            status: 'corrected',
            regularMinutes: proposed.regularMinutes,
            overtimeMinutes: proposed.overtimeMinutes,
          },
          metadata: { via: 'reviewCorrectionRequest', correctionRequestId, approved: true },
        },
        tx
      );
    } else {
      // Reject: only update the correction request
      tx.update(corrRef, {
        status: 'rejected',
        reviewedBy: callerUid,
        reviewedAt: now,
        reviewNotes: notes || null,
        updatedAt: now,
      });

      await logActionInTransaction(
        {
          userId: callerUid,
          action: 'dtr_reject',
          entityType: 'dtr',
          entityId: dtrId,
          originalValue: { status: dtrData.status, traineeId: dtrData.traineeId },
          newValue: { status: dtrData.status, correctionRejected: true },
          metadata: { via: 'reviewCorrectionRequest', correctionRequestId, approved: false },
        },
        tx
      );
    }
  });

  return { success: true, correctionRequestId };
}
