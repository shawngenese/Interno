import { getFirestoreInstancePublic } from '@/config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import type {
  LeaveRequest,
  LeaveFormValues,
  ListLeaveParams,
  PaginatedLeaveResponse,
} from '../types';
import { notifyLeaveRequested, notifyLeaveApproved, notifyLeaveRejected } from '@/features/notifications/services/notificationTriggers';
import { writeWithOfflineFallback } from '@/shared/utils/offline';

const COLLECTIONS = {
  LEAVE_REQUESTS: 'leave_requests',
  TRAINEES: 'trainees',
  USERS: 'users',
} as const;

function toEntity<T>(id: string, data: Record<string, unknown>): T {
  return { id, ...data } as T;
}

/** Create a new leave request (trainee). */
export async function createLeaveRequest(
  traineeId: string,
  companyId: string,
  values: LeaveFormValues,
): Promise<LeaveRequest> {
  const db = getFirestoreInstancePublic();
  const now = serverTimestamp();
  const startMs = new Date(values.startDate).getTime();
  const endMs = new Date(values.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;

  return writeWithOfflineFallback(
    async () => {
      const docRef = await addDoc(collection(db, COLLECTIONS.LEAVE_REQUESTS), {
        traineeId,
        companyId,
        type: values.type,
        startDate: startMs,
        endDate: endMs,
        reason: values.reason,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });

      // Notify supervisor
      try {
        const traineeSnap = await getDocs(query(collection(db, COLLECTIONS.TRAINEES), where('__name__', '==', traineeId)));
        if (!traineeSnap.empty) {
          const traineeData = traineeSnap.docs[0].data();
          const supervisorId = traineeData.supervisorId;
          if (supervisorId) {
            // supervisorId is a supervisor document ID, need to get userId
            const supervisorDoc = await getDoc(doc(db, 'supervisors', supervisorId));
            if (supervisorDoc.exists()) {
              const supervisorUserId = supervisorDoc.data().userId;
              if (supervisorUserId) {
                await notifyLeaveRequested(supervisorUserId, traineeData.name || 'Trainee', values.type, docRef.id);
              }
            }
          }
        }
      } catch {
        // Notification failure is non-blocking
      }

      return {
        id: docRef.id,
        traineeId,
        companyId,
        type: values.type,
        startDate: startMs,
        endDate: endMs,
        reason: values.reason,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as LeaveRequest;
    },
    {
      type: 'create',
      collection: COLLECTIONS.LEAVE_REQUESTS,
      docId: `pending_${Date.now()}`,
      data: { traineeId, companyId, ...values, startDate: startMs, endDate: endMs, status: 'pending' },
    },
  );
}

/** List leave requests with filters and pagination. */
export async function listLeaveRequests(params: ListLeaveParams = {}): Promise<PaginatedLeaveResponse> {
  const db = getFirestoreInstancePublic();
  const page = params.page ?? 1;
  const pageLimit = params.limit ?? 20;
  const constraints: QueryConstraint[] = [];

  if (params.traineeId) constraints.push(where('traineeId', '==', params.traineeId));
  if (params.status) constraints.push(where('status', '==', params.status));
  if (params.type) constraints.push(where('type', '==', params.type));
  if (params.companyId) constraints.push(where('companyId', '==', params.companyId));
  if (params.startDate) constraints.push(where('startDate', '>=', params.startDate));
  if (params.endDate) {
    // endDate is stored as end-of-day in createLeaveRequest, so apply end-of-day offset here too
    const endOfDay = params.endDate + 24 * 60 * 60 * 1000 - 1;
    constraints.push(where('endDate', '<=', endOfDay));
  }

  constraints.push(orderBy('createdAt', 'desc'), firestoreLimit(500));

  const snap = await getDocs(query(collection(db, COLLECTIONS.LEAVE_REQUESTS), ...constraints));
  const all = snap.docs.map((d) => toEntity<LeaveRequest>(d.id, d.data() as Record<string, unknown>));

  const start = (page - 1) * pageLimit;
  const paged = all.slice(start, start + pageLimit);

  return {
    data: paged,
    total: all.length,
    page,
    limit: pageLimit,
    totalPages: Math.ceil(all.length / pageLimit),
  };
}

/** Get a single leave request by ID. */
export async function getLeaveRequest(id: string): Promise<LeaveRequest | null> {
  const db = getFirestoreInstancePublic();
  const snap = await getDocs(query(collection(db, COLLECTIONS.LEAVE_REQUESTS), where('__name__', '==', id)));
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return toEntity<LeaveRequest>(docSnap.id, docSnap.data() as Record<string, unknown>);
}

/** Approve or reject a leave request (supervisor). */
export async function reviewLeaveRequest(
  leaveId: string,
  action: 'approved' | 'rejected',
  supervisorId: string,
  notes?: string,
): Promise<void> {
  const db = getFirestoreInstancePublic();
  const now = serverTimestamp();

  // Perform the write first
  await writeWithOfflineFallback(
    async () => {
      await updateDoc(doc(db, COLLECTIONS.LEAVE_REQUESTS, leaveId), {
        status: action,
        approvedBy: supervisorId,
        approvedAt: now,
        approvalNotes: notes || '',
        updatedAt: now,
      });
    },
    {
      type: 'update',
      collection: COLLECTIONS.LEAVE_REQUESTS,
      docId: leaveId,
      data: { status: action, approvedBy: supervisorId, approvalNotes: notes },
    },
  );

  // Send notification AFTER write succeeds
  const leaveSnap = await getDocs(query(collection(db, COLLECTIONS.LEAVE_REQUESTS), where('__name__', '==', leaveId)));
  if (!leaveSnap.empty) {
    const leaveData = leaveSnap.docs[0].data();
    const typeLabels: Record<string, string> = {
      sick: 'Sick', emergency: 'Emergency', personal: 'Personal',
      school_activity: 'School Activity', company_holiday: 'Company Holiday', other: 'Other',
    };
    const typeLabel = typeLabels[leaveData.type] || leaveData.type;

    if (action === 'approved') {
      await notifyLeaveApproved(leaveData.traineeId, typeLabel, leaveId);
    } else {
      await notifyLeaveRejected(leaveData.traineeId, typeLabel, leaveId);
    }
  }
}

/** Cancel a leave request (trainee, only if pending). */
export async function cancelLeaveRequest(leaveId: string): Promise<void> {
  const db = getFirestoreInstancePublic();
  const now = serverTimestamp();
  return writeWithOfflineFallback(
    async () => {
      await updateDoc(doc(db, COLLECTIONS.LEAVE_REQUESTS, leaveId), {
        status: 'cancelled',
        cancelledAt: now,
        updatedAt: now,
      });
    },
    {
      type: 'update',
      collection: COLLECTIONS.LEAVE_REQUESTS,
      docId: leaveId,
      data: { status: 'cancelled' },
    },
  );
}

/** Get leave requests for a trainee. */
export async function getTraineeLeaveRequests(traineeId: string): Promise<LeaveRequest[]> {
  const db = getFirestoreInstancePublic();
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.LEAVE_REQUESTS),
      where('traineeId', '==', traineeId),
      orderBy('createdAt', 'desc'),
      firestoreLimit(500),
    ),
  );
  return snap.docs.map((d) => toEntity<LeaveRequest>(d.id, d.data() as Record<string, unknown>));
}
