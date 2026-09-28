import { getFunctionsInstancePublic, getFirestoreInstancePublic } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import type { NotificationType, NotificationPriority } from '../types';

interface TriggerNotificationParams {
  type: NotificationType;
  title: string;
  body: string;
  targetUserId: string;
  data?: Record<string, string>;
  priority?: NotificationPriority;
}

export async function triggerNotification(params: TriggerNotificationParams): Promise<void> {
  const { type, title, body, targetUserId, data, priority = 'normal' } = params;

  try {
    const functions = getFunctionsInstancePublic();
    const sendNotification = httpsCallable<TriggerNotificationParams, { inAppCreated: boolean }>(
      functions,
      'sendNotification'
    );
    await sendNotification({ type, title, body, targetUserId, data, priority });
  } catch (err) {
    console.error('Notification trigger failed:', err);
  }
}

/** Notify trainee about task events. */
export async function notifyTaskCreated(traineeId: string, taskTitle: string, taskId: string): Promise<void> {
  const userSnap = await getUserByTraineeId(traineeId);
  if (!userSnap) return;

  await triggerNotification({
    type: 'task_created',
    title: 'New Task Assigned',
    body: `You have a new task: ${taskTitle}`,
    targetUserId: userSnap.userId,
    data: { taskId },
    priority: 'normal',
  });
}

export async function notifyTaskApproved(traineeId: string, taskTitle: string, taskId: string): Promise<void> {
  const userSnap = await getUserByTraineeId(traineeId);
  if (!userSnap) return;

  await triggerNotification({
    type: 'task_approved',
    title: 'Task Approved',
    body: `Your task "${taskTitle}" has been approved!`,
    targetUserId: userSnap.userId,
    data: { taskId },
    priority: 'normal',
  });
}

export async function notifyTaskReturned(traineeId: string, taskTitle: string, taskId: string): Promise<void> {
  const userSnap = await getUserByTraineeId(traineeId);
  if (!userSnap) return;

  await triggerNotification({
    type: 'task_returned',
    title: 'Task Returned for Revision',
    body: `Your task "${taskTitle}" has been returned. Please review feedback.`,
    targetUserId: userSnap.userId,
    data: { taskId },
    priority: 'high',
  });
}

/** Notify supervisor about task submission. */
export async function notifyTaskSubmitted(supervisorUserId: string, traineeName: string, taskTitle: string, taskId: string): Promise<void> {
  await triggerNotification({
    type: 'task_updated',
    title: 'Task Submitted for Review',
    body: `${traineeName} submitted "${taskTitle}" for your review.`,
    targetUserId: supervisorUserId,
    data: { taskId },
    priority: 'normal',
  });
}

/** Notify trainee when their task details have been updated. */
export async function notifyTaskUpdated(traineeId: string, taskTitle: string, taskId: string): Promise<void> {
  const userSnap = await getUserByTraineeId(traineeId);
  if (!userSnap) return;

  await triggerNotification({
    type: 'task_updated',
    title: 'Task Updated',
    body: `Your task "${taskTitle}" has been updated by your supervisor.`,
    targetUserId: userSnap.userId,
    data: { taskId },
    priority: 'normal',
  });
}

async function getUserByTraineeId(traineeId: string): Promise<{ userId: string } | null> {
  const db = getFirestoreInstancePublic();
  const snap = await getDoc(doc(db, 'trainees', traineeId));
  if (snap.exists()) {
    const data = snap.data() as { userId?: string };
    if (data.userId) return { userId: data.userId };
  }
  const userSnap = await getDoc(doc(db, 'users', traineeId));
  if (userSnap.exists()) return { userId: traineeId };
  return null;
}

/** Notify supervisor about new leave request. */
export async function notifyLeaveRequested(supervisorUserId: string, traineeName: string, leaveType: string, leaveId: string): Promise<void> {
  await triggerNotification({
    type: 'leave_requested',
    title: 'New Leave Request',
    body: `${traineeName} submitted a ${leaveType} leave request.`,
    targetUserId: supervisorUserId,
    data: { leaveId },
    priority: 'normal',
  });
}

/** Notify trainee about leave approval. */
export async function notifyLeaveApproved(traineeId: string, leaveType: string, leaveId: string): Promise<void> {
  const userSnap = await getUserByTraineeId(traineeId);
  if (!userSnap) return;

  await triggerNotification({
    type: 'leave_approved',
    title: 'Leave Approved',
    body: `Your ${leaveType} leave request has been approved.`,
    targetUserId: userSnap.userId,
    data: { leaveId },
    priority: 'normal',
  });
}

/** Notify trainee about leave rejection. */
export async function notifyLeaveRejected(traineeId: string, leaveType: string, leaveId: string): Promise<void> {
  const userSnap = await getUserByTraineeId(traineeId);
  if (!userSnap) return;

  await triggerNotification({
    type: 'leave_rejected',
    title: 'Leave Rejected',
    body: `Your ${leaveType} leave request has been rejected.`,
    targetUserId: userSnap.userId,
    data: { leaveId },
    priority: 'high',
  });
}

/** Get supervisor userId assigned to a trainee. */
export async function getSupervisorUserIdByTraineeId(traineeId: string): Promise<string | null> {
  try {
    const db = getFirestoreInstancePublic();
    const snap = await getDoc(doc(db, 'trainees', traineeId));
    if (!snap.exists()) return null;
    const tData = snap.data() as { supervisorId?: string };
    if (!tData.supervisorId) return null;

    const userSnap = await getDoc(doc(db, 'users', tData.supervisorId));
    if (userSnap.exists()) return tData.supervisorId;

    const { query, collection, where, limit, getDocs } = await import('firebase/firestore');
    const qSnap = await getDocs(
      query(collection(db, 'users'), where('supervisorId', '==', tData.supervisorId), limit(1))
    );
    if (!qSnap.empty) return qSnap.docs[0].id;

    return tData.supervisorId;
  } catch (err) {
    console.error('Failed to resolve supervisor userId:', err);
    return null;
  }
}

/** Notify supervisor about trainee DTR correction request. */
export async function notifyDTRCorrectionRequested(
  traineeId: string,
  traineeName: string,
  dtrId: string,
  reason: string
): Promise<void> {
  const supervisorUserId = await getSupervisorUserIdByTraineeId(traineeId);
  if (!supervisorUserId) return;

  await triggerNotification({
    type: 'dtr_pending',
    title: 'DTR Correction Request',
    body: `${traineeName} requested a DTR correction: "${reason}".`,
    targetUserId: supervisorUserId,
    data: { dtrId, traineeId },
    priority: 'high',
  });
}

/** Notify trainee that DTR was approved. */
export async function notifyDTRApproved(traineeId: string, dateLabel: string, dtrId: string): Promise<void> {
  const userSnap = await getUserByTraineeId(traineeId);
  if (!userSnap) return;

  await triggerNotification({
    type: 'dtr_approved',
    title: 'DTR Approved',
    body: `Your Daily Time Record for ${dateLabel} has been approved.`,
    targetUserId: userSnap.userId,
    data: { dtrId },
    priority: 'normal',
  });
}

/** Notify trainee that DTR was rejected. */
export async function notifyDTRRejected(
  traineeId: string,
  dateLabel: string,
  dtrId: string,
  reason?: string
): Promise<void> {
  const userSnap = await getUserByTraineeId(traineeId);
  if (!userSnap) return;

  await triggerNotification({
    type: 'dtr_rejected',
    title: 'DTR Rejected',
    body: `Your Daily Time Record for ${dateLabel} was rejected.${reason ? ` Reason: ${reason}` : ''}`,
    targetUserId: userSnap.userId,
    data: { dtrId },
    priority: 'high',
  });
}

/** Notify trainee about correction request decision. */
export async function notifyDTRCorrectionReviewed(
  traineeId: string,
  action: 'approve' | 'reject',
  dtrId: string
): Promise<void> {
  const userSnap = await getUserByTraineeId(traineeId);
  if (!userSnap) return;

  await triggerNotification({
    type: action === 'approve' ? 'dtr_approved' : 'dtr_rejected',
    title: action === 'approve' ? 'DTR Correction Approved' : 'DTR Correction Rejected',
    body: `Your DTR correction request has been ${action === 'approve' ? 'approved' : 'rejected'}.`,
    targetUserId: userSnap.userId,
    data: { dtrId },
    priority: action === 'approve' ? 'normal' : 'high',
  });
}

/** Get coordinator userIds assigned or relevant to a trainee. */
export async function getCoordinatorUserIdsByTraineeId(traineeId: string): Promise<string[]> {
  try {
    const db = getFirestoreInstancePublic();
    const snap = await getDoc(doc(db, 'trainees', traineeId));
    if (!snap.exists()) return [];
    const tData = snap.data() as { companyId?: string };

    const { query, collection, where, limit, getDocs } = await import('firebase/firestore');

    if (tData.companyId) {
      const qSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('role', '==', 'coordinator'),
          where('companyId', '==', tData.companyId),
          limit(10)
        )
      );
      if (!qSnap.empty) {
        return qSnap.docs.map((d) => d.id);
      }
    }

    // Fallback: any coordinator in system
    const fallbackSnap = await getDocs(
      query(collection(db, 'users'), where('role', '==', 'coordinator'), limit(5))
    );
    return fallbackSnap.docs.map((d) => d.id);
  } catch (err) {
    console.error('Failed to resolve coordinator userIds:', err);
    return [];
  }
}

/** Notify coordinators about trainee document upload. */
export async function notifyDocumentUploaded(
  traineeId: string,
  traineeName: string,
  documentType: string,
  docId: string
): Promise<void> {
  const coordinatorUserIds = await getCoordinatorUserIdsByTraineeId(traineeId);
  const typeLabel = documentType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  for (const coordId of coordinatorUserIds) {
    await triggerNotification({
      type: 'document_pending',
      title: 'New Document Uploaded',
      body: `${traineeName} uploaded a ${typeLabel} for verification.`,
      targetUserId: coordId,
      data: { docId, traineeId },
      priority: 'normal',
    });
  }
}

/** Notify trainee that a document was approved. */
export async function notifyDocumentApproved(
  traineeId: string,
  documentType: string,
  docId: string
): Promise<void> {
  const userSnap = await getUserByTraineeId(traineeId);
  if (!userSnap) return;

  const typeLabel = documentType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  await triggerNotification({
    type: 'document_approved',
    title: 'Document Approved',
    body: `Your ${typeLabel} has been reviewed and approved by your coordinator.`,
    targetUserId: userSnap.userId,
    data: { docId },
    priority: 'normal',
  });
}

/** Notify trainee that a document was rejected. */
export async function notifyDocumentRejected(
  traineeId: string,
  documentType: string,
  docId: string,
  reason?: string
): Promise<void> {
  const userSnap = await getUserByTraineeId(traineeId);
  if (!userSnap) return;

  const typeLabel = documentType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  await triggerNotification({
    type: 'document_rejected',
    title: 'Document Rejected',
    body: `Your ${typeLabel} was rejected.${reason ? ` Reason: ${reason}` : ' Please re-upload with requested revisions.'}`,
    targetUserId: userSnap.userId,
    data: { docId },
    priority: 'high',
  });
}

/** Notify trainee and coordinators that an evaluation has been submitted by supervisor. */
export async function notifyEvaluationSubmitted(evaluation: {
  id: string;
  traineeId: string;
  traineeName: string;
  supervisorName: string;
  type: string;
  overallRating?: number;
  companyId?: string;
}): Promise<void> {
  const typeLabel = evaluation.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  // 1. Notify Trainee
  const traineeUser = await getUserByTraineeId(evaluation.traineeId);
  if (traineeUser) {
    await triggerNotification({
      type: 'evaluation_submitted',
      title: 'Performance Evaluation Submitted',
      body: `Your supervisor ${evaluation.supervisorName} submitted your ${typeLabel} evaluation${
        evaluation.overallRating ? ` (Score: ${evaluation.overallRating}/5)` : ''
      }.`,
      targetUserId: traineeUser.userId,
      data: { evaluationId: evaluation.id, traineeId: evaluation.traineeId },
      priority: 'normal',
    });
  }

  // 2. Notify Coordinator(s)
  const coordinatorUserIds = await getCoordinatorUserIdsByTraineeId(evaluation.traineeId);
  for (const coordId of coordinatorUserIds) {
    await triggerNotification({
      type: 'evaluation_submitted',
      title: 'New Trainee Evaluation',
      body: `${evaluation.supervisorName} submitted a ${typeLabel} evaluation for ${evaluation.traineeName}.`,
      targetUserId: coordId,
      data: { evaluationId: evaluation.id, traineeId: evaluation.traineeId },
      priority: 'normal',
    });
  }
}

/** Notify trainee and supervisor that an evaluation has been reviewed by coordinator. */
export async function notifyEvaluationReviewed(evaluation: {
  id: string;
  traineeId: string;
  traineeName: string;
  supervisorId: string;
  type: string;
  overallRating?: number;
  reviewComments?: string;
}): Promise<void> {
  const typeLabel = evaluation.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  // 1. Notify Trainee
  const traineeUser = await getUserByTraineeId(evaluation.traineeId);
  if (traineeUser) {
    await triggerNotification({
      type: 'evaluation_reviewed',
      title: 'Evaluation Reviewed',
      body: `Your ${typeLabel} evaluation has been reviewed by your coordinator.${
        evaluation.reviewComments ? ` Comments: "${evaluation.reviewComments}"` : ''
      }`,
      targetUserId: traineeUser.userId,
      data: { evaluationId: evaluation.id, traineeId: evaluation.traineeId },
      priority: 'normal',
    });
  }

  // 2. Notify Supervisor
  if (evaluation.supervisorId) {
    await triggerNotification({
      type: 'evaluation_reviewed',
      title: 'Evaluation Reviewed by Coordinator',
      body: `Coordinator reviewed your ${typeLabel} evaluation for ${evaluation.traineeName}.`,
      targetUserId: evaluation.supervisorId,
      data: { evaluationId: evaluation.id, traineeId: evaluation.traineeId },
      priority: 'normal',
    });
  }
}

/** Notify trainee and supervisor that an evaluation has been finalized by coordinator. */
export async function notifyEvaluationFinalized(evaluation: {
  id: string;
  traineeId: string;
  traineeName: string;
  supervisorId: string;
  type: string;
  overallRating?: number;
}): Promise<void> {
  const typeLabel = evaluation.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  // 1. Notify Trainee
  const traineeUser = await getUserByTraineeId(evaluation.traineeId);
  if (traineeUser) {
    await triggerNotification({
      type: 'evaluation_finalized',
      title: 'Evaluation Finalized',
      body: `Your official ${typeLabel} evaluation has been finalized (Final Score: ${
        evaluation.overallRating ? `${evaluation.overallRating}/5` : 'Recorded'
      }).`,
      targetUserId: traineeUser.userId,
      data: { evaluationId: evaluation.id, traineeId: evaluation.traineeId },
      priority: 'normal',
    });
  }

  // 2. Notify Supervisor
  if (evaluation.supervisorId) {
    await triggerNotification({
      type: 'evaluation_finalized',
      title: 'Evaluation Finalized',
      body: `The ${typeLabel} evaluation for ${evaluation.traineeName} has been officially finalized.`,
      targetUserId: evaluation.supervisorId,
      data: { evaluationId: evaluation.id, traineeId: evaluation.traineeId },
      priority: 'normal',
    });
  }
}

/** Resolve supervisor user info (UID + Name). */
export async function resolveSupervisorUser(supervisorId: string): Promise<{ userId: string; name: string } | null> {
  if (!supervisorId) return null;
  try {
    const db = getFirestoreInstancePublic();
    const userSnap = await getDoc(doc(db, 'users', supervisorId));
    if (userSnap.exists()) {
      const uData = userSnap.data();
      return {
        userId: supervisorId,
        name: (uData.displayName as string) || (uData.name as string) || (uData.email as string) || 'Supervisor',
      };
    }
    const supSnap = await getDoc(doc(db, 'supervisors', supervisorId));
    if (supSnap.exists()) {
      const sData = supSnap.data();
      const sUserId = (sData.userId as string) || supervisorId;
      const sUserSnap = await getDoc(doc(db, 'users', sUserId));
      const sName = sUserSnap.exists()
        ? (sUserSnap.data().displayName as string) || (sUserSnap.data().name as string) || (sData.name as string) || (sData.email as string) || 'Supervisor'
        : (sData.name as string) || (sData.email as string) || 'Supervisor';
      return { userId: sUserId, name: sName };
    }
    return { userId: supervisorId, name: 'Supervisor' };
  } catch (err) {
    console.error('Failed to resolve supervisor user:', err);
    return { userId: supervisorId, name: 'Supervisor' };
  }
}

/** Resolve trainee user info (UID + Name). */
export async function resolveTraineeUser(traineeId: string): Promise<{ userId: string; name: string } | null> {
  if (!traineeId) return null;
  try {
    const db = getFirestoreInstancePublic();
    const traineeSnap = await getDoc(doc(db, 'trainees', traineeId));
    if (traineeSnap.exists()) {
      const tData = traineeSnap.data();
      const tUserId = (tData.userId as string) || traineeId;
      const tUserSnap = await getDoc(doc(db, 'users', tUserId));
      const tName = tUserSnap.exists()
        ? (tUserSnap.data().displayName as string) || (tUserSnap.data().name as string) || (tData.name as string) || 'Trainee'
        : (tData.name as string) || 'Trainee';
      return { userId: tUserId, name: tName };
    }
    const userSnap = await getDoc(doc(db, 'users', traineeId));
    if (userSnap.exists()) {
      const uData = userSnap.data();
      return {
        userId: traineeId,
        name: (uData.displayName as string) || (uData.name as string) || (uData.email as string) || 'Trainee',
      };
    }
    return null;
  } catch (err) {
    console.error('Failed to resolve trainee user:', err);
    return null;
  }
}

/** Notify coordinators about external placement request. */
export async function notifyPlacementRequested(params: {
  requestId: string;
  traineeId: string;
  traineeName: string;
  externalCompanyId: string;
  externalCompanyName: string;
}): Promise<void> {
  const coordinatorUserIds = await getCoordinatorUserIdsByTraineeId(params.traineeId);
  for (const coordId of coordinatorUserIds) {
    await triggerNotification({
      type: 'placement_requested',
      title: 'New Placement Request',
      body: `${params.traineeName} requested external placement at ${params.externalCompanyName}.`,
      targetUserId: coordId,
      data: {
        requestId: params.requestId,
        traineeId: params.traineeId,
        externalCompanyId: params.externalCompanyId,
      },
      priority: 'normal',
    });
  }
}

/** Notify trainee that placement request was approved. */
export async function notifyPlacementApproved(params: {
  requestId: string;
  traineeId: string;
  externalCompanyName: string;
}): Promise<void> {
  const traineeUser = await getUserByTraineeId(params.traineeId);
  if (!traineeUser) return;

  await triggerNotification({
    type: 'placement_approved',
    title: 'Placement Request Approved',
    body: `Your external placement request for ${params.externalCompanyName} has been approved!`,
    targetUserId: traineeUser.userId,
    data: { requestId: params.requestId },
    priority: 'normal',
  });
}

/** Notify trainee that placement request was rejected. */
export async function notifyPlacementRejected(params: {
  requestId: string;
  traineeId: string;
  externalCompanyName: string;
  reason?: string;
}): Promise<void> {
  const traineeUser = await getUserByTraineeId(params.traineeId);
  if (!traineeUser) return;

  await triggerNotification({
    type: 'placement_rejected',
    title: 'Placement Request Rejected',
    body: `Your placement request for ${params.externalCompanyName} was rejected.${
      params.reason ? ` Reason: ${params.reason}` : ''
    }`,
    targetUserId: traineeUser.userId,
    data: { requestId: params.requestId },
    priority: 'high',
  });
}

/** Notify trainee and supervisor when supervisor is assigned. */
export async function notifySupervisorAssigned(params: {
  traineeId: string;
  supervisorId: string;
  oldSupervisorId?: string;
}): Promise<void> {
  const [traineeInfo, supervisorInfo, oldSupervisorInfo] = await Promise.all([
    resolveTraineeUser(params.traineeId),
    resolveSupervisorUser(params.supervisorId),
    params.oldSupervisorId ? resolveSupervisorUser(params.oldSupervisorId) : Promise.resolve(null),
  ]);

  if (!traineeInfo || !supervisorInfo) return;

  // 1. Notify Trainee
  await triggerNotification({
    type: 'supervisor_assigned',
    title: 'Supervisor Assigned',
    body: `You have been assigned to supervisor ${supervisorInfo.name}.`,
    targetUserId: traineeInfo.userId,
    data: { traineeId: params.traineeId, supervisorId: params.supervisorId },
    priority: 'normal',
  });

  // 2. Notify New Supervisor
  await triggerNotification({
    type: 'trainee_assigned',
    title: 'New Trainee Assigned',
    body: `${traineeInfo.name} has been assigned to your supervision.`,
    targetUserId: supervisorInfo.userId,
    data: { traineeId: params.traineeId },
    priority: 'normal',
  });

  // 3. Notify Old Supervisor if reassigning
  if (oldSupervisorInfo && oldSupervisorInfo.userId !== supervisorInfo.userId) {
    await triggerNotification({
      type: 'trainee_unassigned',
      title: 'Trainee Reassigned',
      body: `${traineeInfo.name} has been reassigned to another supervisor.`,
      targetUserId: oldSupervisorInfo.userId,
      data: { traineeId: params.traineeId },
      priority: 'normal',
    });
  }
}

/** Notify trainee and supervisor when supervisor is unassigned (removed). */
export async function notifySupervisorUnassigned(params: {
  traineeId: string;
  oldSupervisorId: string;
}): Promise<void> {
  const [traineeInfo, oldSupervisorInfo] = await Promise.all([
    resolveTraineeUser(params.traineeId),
    resolveSupervisorUser(params.oldSupervisorId),
  ]);

  if (!traineeInfo || !oldSupervisorInfo) return;

  // 1. Notify Trainee
  await triggerNotification({
    type: 'supervisor_unassigned',
    title: 'Supervisor Unassigned',
    body: `You have been unassigned from supervisor ${oldSupervisorInfo.name}.`,
    targetUserId: traineeInfo.userId,
    data: { traineeId: params.traineeId },
    priority: 'normal',
  });

  // 2. Notify Old Supervisor
  await triggerNotification({
    type: 'trainee_unassigned',
    title: 'Trainee Unassigned',
    body: `${traineeInfo.name} has been unassigned from your supervision.`,
    targetUserId: oldSupervisorInfo.userId,
    data: { traineeId: params.traineeId },
    priority: 'normal',
  });
}

/**
 * Check OJT completion percentage for a trainee and trigger milestone notifications (50%, 75%, 100%)
 * Idempotent: Tracks notified milestones in trainee document to avoid duplicate alerts.
 */
export async function checkAndNotifyOJTMilestones(traineeId: string): Promise<void> {
  try {
    const db = getFirestoreInstancePublic();
    const traineeRef = doc(db, 'trainees', traineeId);
    const traineeSnap = await getDoc(traineeRef);
    if (!traineeSnap.exists()) return;

    const traineeData = traineeSnap.data();
    const reqHours = Number(
      traineeData.ojtHoursRequired ?? traineeData.requiredHours ?? traineeData.totalHours ?? 480
    );
    if (reqHours <= 0) return;

    // Fetch approved DTR entries to calculate accurate rendered hours
    const { query, collection, where, getDocs, updateDoc, arrayUnion } = await import('firebase/firestore');
    const dtrSnap = await getDocs(
      query(collection(db, 'dtrs'), where('traineeId', '==', traineeId), where('status', '==', 'approved'))
    );

    let totalMins = 0;
    dtrSnap.docs.forEach((d) => {
      const data = d.data();
      totalMins += (data.regularMinutes || 0) + (data.overtimeMinutes || 0);
    });

    const completedHours = Math.round((totalMins / 60) * 10) / 10;
    const percent = Math.floor((completedHours / reqHours) * 100);

    const notifiedMilestones: number[] = (traineeData.milestonesNotified as number[]) || [];
    const milestoneThresholds = [50, 75, 100];
    const newMilestonesToNotify: number[] = [];

    const traineeInfo = await resolveTraineeUser(traineeId);
    if (!traineeInfo) return;

    const supervisorUserId = await getSupervisorUserIdByTraineeId(traineeId);
    const coordinatorUserIds = await getCoordinatorUserIdsByTraineeId(traineeId);

    for (const threshold of milestoneThresholds) {
      if (percent >= threshold && !notifiedMilestones.includes(threshold)) {
        newMilestonesToNotify.push(threshold);

        const isComplete = threshold === 100;
        const title = isComplete
          ? 'OJT Hours Completed!'
          : `OJT Milestone: ${threshold}% Reached`;

        // 1. Notify Trainee
        const traineeBody = isComplete
          ? `Milestone achieved! You have completed 100% of your required OJT hours (${completedHours}h / ${reqHours}h rendered)!`
          : `Congratulations! You have reached ${threshold}% of your required OJT hours (${completedHours}h / ${reqHours}h rendered).`;

        await triggerNotification({
          type: 'ojt_milestone_reached',
          title,
          body: traineeBody,
          targetUserId: traineeInfo.userId,
          data: { traineeId, milestone: String(threshold), completedHours: String(completedHours) },
          priority: isComplete ? 'high' : 'normal',
        });

        // 2. Notify Supervisor
        if (supervisorUserId) {
          const supervisorBody = isComplete
            ? `${traineeInfo.name} has completed 100% of their required OJT hours (${completedHours}h / ${reqHours}h). Please prepare their final evaluation.`
            : `${traineeInfo.name} has reached ${threshold}% of their required OJT hours (${completedHours}h / ${reqHours}h).`;

          await triggerNotification({
            type: 'ojt_milestone_reached',
            title: isComplete ? `Trainee Completed OJT: ${traineeInfo.name}` : `Trainee Milestone: ${traineeInfo.name} (${threshold}%)`,
            body: supervisorBody,
            targetUserId: supervisorUserId,
            data: { traineeId, milestone: String(threshold), completedHours: String(completedHours) },
            priority: 'normal',
          });
        }

        // 3. Notify Coordinators
        for (const coordId of coordinatorUserIds) {
          const coordBody = isComplete
            ? `${traineeInfo.name} has completed all required OJT hours (${completedHours}h / ${reqHours}h).`
            : `${traineeInfo.name} reached ${threshold}% OJT hours completion (${completedHours}h / ${reqHours}h).`;

          await triggerNotification({
            type: 'ojt_milestone_reached',
            title: isComplete ? `Trainee OJT Complete: ${traineeInfo.name}` : `OJT Progress: ${traineeInfo.name} (${threshold}%)`,
            body: coordBody,
            targetUserId: coordId,
            data: { traineeId, milestone: String(threshold), completedHours: String(completedHours) },
            priority: 'normal',
          });
        }
      }
    }

    // Persist completed hours and notified milestones on trainee doc
    const updates: Record<string, unknown> = {
      ojtHoursCompleted: completedHours,
    };
    if (newMilestonesToNotify.length > 0) {
      updates.milestonesNotified = arrayUnion(...newMilestonesToNotify);
    }
    await updateDoc(traineeRef, updates);
  } catch (err) {
    console.error('Failed to check and notify OJT milestones:', err);
  }
}

/** Notify trainee about task due soon (within 24 hours). */
export async function notifyTaskDueSoon(params: {
  taskId: string;
  taskTitle: string;
  traineeId: string;
  hoursLeft: number;
}): Promise<void> {
  const traineeUser = await getUserByTraineeId(params.traineeId);
  if (!traineeUser) return;

  await triggerNotification({
    type: 'task_due_soon',
    title: `Task Due Soon: ${params.taskTitle}`,
    body: `Your task "${params.taskTitle}" is due in ${params.hoursLeft} hours. Please submit your deliverable on time.`,
    targetUserId: traineeUser.userId,
    data: { taskId: params.taskId, traineeId: params.traineeId },
    priority: 'high',
  });
}

/** Notify trainee and supervisor that a task is overdue. */
export async function notifyTaskOverdue(params: {
  taskId: string;
  taskTitle: string;
  traineeId: string;
  createdBy?: string;
}): Promise<void> {
  const traineeInfo = await resolveTraineeUser(params.traineeId);
  if (!traineeInfo) return;

  // 1. Notify Trainee
  await triggerNotification({
    type: 'task_overdue',
    title: `Task Overdue: ${params.taskTitle}`,
    body: `Your task "${params.taskTitle}" is past its deadline. Please complete and submit it as soon as possible.`,
    targetUserId: traineeInfo.userId,
    data: { taskId: params.taskId, traineeId: params.traineeId },
    priority: 'urgent',
  });

  // 2. Notify Creator / Supervisor
  const supervisorUserId = params.createdBy || (await getSupervisorUserIdByTraineeId(params.traineeId));
  if (supervisorUserId && supervisorUserId !== traineeInfo.userId) {
    await triggerNotification({
      type: 'task_overdue',
      title: `Trainee Task Overdue: ${params.taskTitle}`,
      body: `${traineeInfo.name}'s task "${params.taskTitle}" is now overdue.`,
      targetUserId: supervisorUserId,
      data: { taskId: params.taskId, traineeId: params.traineeId },
      priority: 'high',
    });
  }
}

/**
 * Scan active tasks and trigger due soon / overdue notifications.
 * Idempotent: Marks dueSoonNotified and overdueNotified on task doc.
 */
export async function checkAndNotifyTaskDeadlines(params: {
  traineeId?: string;
  companyId?: string;
} = {}): Promise<void> {
  try {
    // Only supervisors, coordinators, or admins should run deadline background checks
    if (typeof window !== 'undefined' && window.__USER_ROLE__ === 'trainee') {
      return;
    }

    const db = getFirestoreInstancePublic();
    const { collection, query, where, getDocs, updateDoc, doc, limit } = await import('firebase/firestore');

    const constraints = [
      where('status', 'in', ['pending', 'in_progress', 'returned']),
      limit(100),
    ];

    if (params.traineeId) {
      constraints.unshift(where('traineeId', '==', params.traineeId));
    } else if (params.companyId) {
      constraints.unshift(where('companyId', '==', params.companyId));
    }

    const q = query(collection(db, 'tasks'), ...constraints);
    const snap = await getDocs(q);
    const now = Date.now();

    for (const docSnap of snap.docs) {
      const task = docSnap.data();
      const { getTaskDueEndOfDay } = await import('@/features/tasks/utils/taskUtils');
      const dueMs = getTaskDueEndOfDay(task.dueDate);

      if (!dueMs || dueMs === Infinity || Number.isNaN(dueMs)) continue;

      const msRemaining = dueMs - now;
      const taskId = docSnap.id;
      const traineeId = (task.traineeId as string) || '';
      const taskTitle = (task.title as string) || 'Task';
      const createdBy = task.createdBy as string | undefined;

      // 1. Overdue Check: past due date
      if (msRemaining <= 0) {
        if (!task.overdueNotified) {
          await notifyTaskOverdue({ taskId, taskTitle, traineeId, createdBy });
          await updateDoc(doc(db, 'tasks', taskId), {
            overdueNotified: true,
            dueSoonNotified: true, // suppress due soon if already overdue
          });
        }
      }
      // 2. Due Soon Check: within 24 hours
      else if (msRemaining <= 24 * 60 * 60 * 1000) {
        if (!task.dueSoonNotified) {
          const hoursLeft = Math.max(1, Math.round(msRemaining / (60 * 60 * 1000)));
          await notifyTaskDueSoon({ taskId, taskTitle, traineeId, hoursLeft });
          await updateDoc(doc(db, 'tasks', taskId), {
            dueSoonNotified: true,
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to check and notify task deadlines:', err);
  }
}





