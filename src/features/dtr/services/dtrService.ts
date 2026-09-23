import { getFunctionsInstancePublic } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import type { QueryConstraint } from 'firebase/firestore';
import type {
  DTREntry,
  DTRCorrectionRequest,
  DTRSummary,
  CalculateDTRParams,
  CalculateDTRResult,
  ListDTRParams,
  PaginatedDTRResponse,
} from '../types';

const LIST_FETCH_CAP = 500;

/** Calculate DTR for a trainee over a date range (calls Cloud Function). */
export async function calculateDTR(params: CalculateDTRParams): Promise<CalculateDTRResult> {
  const functions = getFunctionsInstancePublic();
  const calculateDTRFn = httpsCallable<CalculateDTRParams, CalculateDTRResult>(functions, 'calculateDTR');
  const result = await calculateDTRFn(params);
  return result.data;
}

/** Approve a DTR entry (calls Cloud Function with audit logging). */
export async function approveDTR(dtrId: string, notes?: string): Promise<{ success: boolean; dtrId: string }> {
  const functions = getFunctionsInstancePublic();
  const fn = httpsCallable<{ dtrId: string; notes?: string }, { success: boolean; dtrId: string }>(functions, 'approveDTR');
  const result = await fn({ dtrId, notes });
  return result.data;
}

/** Reject a DTR entry (calls Cloud Function with audit logging). */
export async function rejectDTR(dtrId: string, reason?: string): Promise<{ success: boolean; dtrId: string }> {
  const functions = getFunctionsInstancePublic();
  const fn = httpsCallable<{ dtrId: string; reason?: string }, { success: boolean; dtrId: string }>(functions, 'rejectDTR');
  const result = await fn({ dtrId, reason });
  return result.data;
}

/** Review a DTR correction request (calls Cloud Function with transaction + audit logging). */
export async function reviewCorrectionRequest(
  dtrId: string,
  correctionRequestId: string,
  action: 'approve' | 'reject',
  notes?: string,
): Promise<{ success: boolean; correctionRequestId: string }> {
  const functions = getFunctionsInstancePublic();
  const fn = httpsCallable<
    { dtrId: string; correctionRequestId: string; action: 'approve' | 'reject'; notes?: string },
    { success: boolean; correctionRequestId: string }
  >(functions, 'reviewCorrectionRequest');
  const result = await fn({ dtrId, correctionRequestId, action, notes });
  return result.data;
}

/** Get a single DTR entry by ID. */
export async function getDTR(id: string): Promise<DTREntry | null> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { doc, getDoc } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();
  const snap = await getDoc(doc(db, 'dtrs', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as DTREntry) : null;
}

/** List DTR entries with filters and pagination. */
export async function listDTRs(params: ListDTRParams = {}): Promise<PaginatedDTRResponse> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const page = params.page ?? 1;
  const pageLimit = params.limit ?? 20;
  const constraints: QueryConstraint[] = [];
  if (params.traineeId) constraints.push(where('traineeId', '==', params.traineeId));
  if (params.status) constraints.push(where('status', '==', params.status));
  if (params.companyId) constraints.push(where('companyId', '==', params.companyId));
  if (params.startDate) constraints.push(where('date', '>=', params.startDate));
  if (params.endDate) constraints.push(where('date', '<=', params.endDate));

  constraints.push(orderBy('date', 'desc'), limit(LIST_FETCH_CAP));

  const snap = await getDocs(query(collection(db, 'dtrs'), ...constraints));
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DTREntry));

  // Client-side sort by date desc (already ordered by query)
  const start = (page - 1) * pageLimit;
  return {
    data: all.slice(start, start + pageLimit),
    total: all.length,
    page,
    limit: pageLimit,
    totalPages: Math.max(1, Math.ceil(all.length / pageLimit)),
  };
}

/** Get DTR summary for a trainee over a period. */
export async function getDTRSummary(traineeId: string, startDate: number, endDate: number): Promise<DTRSummary> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const snap = await getDocs(
    query(
      collection(db, 'dtrs'),
      where('traineeId', '==', traineeId),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'asc'),
    ),
  );

  const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DTREntry));

  const totalRegularHours = entries.reduce((sum, e) => sum + e.regularMinutes / 60, 0);
  const totalOvertimeHours = entries.reduce((sum, e) => sum + e.overtimeMinutes / 60, 0);
  const totalLateMinutes = entries.reduce((sum, e) => sum + e.lateMinutes, 0);
  const totalUndertimeMinutes = entries.reduce((sum, e) => sum + e.undertimeMinutes, 0);
  const totalNightDiffHours = entries.reduce((sum, e) => sum + e.nightDiffMinutes / 60, 0);

  return {
    traineeId,
    periodStart: startDate,
    periodEnd: endDate,
    totalDays: entries.length,
    totalRegularHours: Number(totalRegularHours.toFixed(2)),
    totalOvertimeHours: Number(totalOvertimeHours.toFixed(2)),
    totalLateMinutes: Math.round(totalLateMinutes),
    totalUndertimeMinutes: Math.round(totalUndertimeMinutes),
    totalNightDiffHours: Number(totalNightDiffHours.toFixed(2)),
    entries,
  };
}

/** Create a correction request for a DTR entry. */
export async function createCorrectionRequest(
  dtrId: string,
  reason: string,
  proposedValue: Partial<DTREntry>,
): Promise<DTRCorrectionRequest> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { doc, getDoc, addDoc, collection, serverTimestamp } = await import('firebase/firestore');
  const { getAuthInstancePublic } = await import('@/config/firebase');
  const auth = getAuthInstancePublic();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const dtrSnap = await getDoc(doc(getFirestoreInstancePublic(), 'dtrs', dtrId));
  if (!dtrSnap.exists()) throw new Error('DTR not found');
  const dtr = dtrSnap.data() as DTREntry;

  const db = getFirestoreInstancePublic();
  const ref = await addDoc(collection(db, 'dtrs', dtrId, 'correction_requests'), {
    dtrId,
    traineeId: dtr.traineeId,
    requestedBy: currentUser.uid,
    reason,
    originalValue: dtr,
    proposedValue,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Re-fetch to get actual server-resolved timestamps (serverTimestamp() resolves on write)
  const createdSnap = await getDoc(ref);
  return { id: createdSnap.id, ...createdSnap.data() } as DTRCorrectionRequest;
}

/** List correction requests for a DTR. */
export async function listCorrectionRequests(dtrId: string): Promise<DTRCorrectionRequest[]> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, orderBy, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const snap = await getDocs(
    query(
      collection(db, 'dtrs', dtrId, 'correction_requests'),
      orderBy('createdAt', 'desc'),
    ),
  );

  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DTRCorrectionRequest));
}