import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { Supervisor, Trainee } from '@/features/admin/types';
import type { DTREntry } from '@/features/dtr/types';

const COLLECTIONS = {
  USERS: 'users',
  SUPERVISORS: 'supervisors',
  TRAINEES: 'trainees',
  DTRS: 'dtrs',
} as const;

function toEntity<T>(id: string, data: Record<string, unknown>): T {
  return { id, ...data } as T;
}

/** Get supervisor record by userId (the logged-in user's UID). */
export async function getSupervisorByUserId(userId: string): Promise<Supervisor | null> {
  const db = getFirestoreInstancePublic();
  const { doc, getDoc } = await import('firebase/firestore');

  // Direct doc lookup first (supervisors doc ID equals userId — avoids collection query permission issues)
  const directSnap = await getDoc(doc(db, COLLECTIONS.SUPERVISORS, userId));
  if (directSnap.exists()) {
    return toEntity<Supervisor>(directSnap.id, directSnap.data() as Record<string, unknown>);
  }

  // Fallback: query by userId field (in case doc ID differs from userId)
  const q = query(
    collection(db, COLLECTIONS.SUPERVISORS),
    where('userId', '==', userId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    const docSnap = snap.docs[0];
    return toEntity<Supervisor>(docSnap.id, docSnap.data() as Record<string, unknown>);
  }

  return null;
}

/** Get trainees assigned to a supervisor. Queries trainees where supervisorId matches. */
export async function getAssignedTrainees(supervisorId: string, _companyId?: string): Promise<Trainee[]> {
  const db = getFirestoreInstancePublic();

  // Query trainees where supervisorId matches this supervisor
  const q = query(
    collection(db, COLLECTIONS.TRAINEES),
    where('supervisorId', '==', supervisorId),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>;
    return toEntity<Trainee>(d.id, { ...data, name: data.name as string });
  });
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Get pending DTRs for trainees assigned to a supervisor. */
export async function getPendingDTRs(traineeIds: string[]): Promise<DTREntry[]> {
  if (traineeIds.length === 0) return [];
  const db = getFirestoreInstancePublic();
  const chunks = chunkArray(traineeIds, 30);
  const results: DTREntry[] = [];
  for (const chunk of chunks) {
    const q = query(
      collection(db, COLLECTIONS.DTRS),
      where('traineeId', 'in', chunk),
      where('status', '==', 'pending'),
    );
    const snap = await getDocs(q);
    results.push(...snap.docs.map(d => toEntity<DTREntry>(d.id, d.data() as Record<string, unknown>)));
  }
  return results;
}

/** Get today's attendance summary for assigned trainees. */
export async function getTraineeAttendanceSummary(
  traineeIds: string[],
): Promise<Record<string, { hasTimeIn: boolean; hasTimeOut: boolean }>> {
  if (traineeIds.length === 0) return {};
  const db = getFirestoreInstancePublic();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const result: Record<string, { hasTimeIn: boolean; hasTimeOut: boolean }> = {};
  for (const id of traineeIds) {
    result[id] = { hasTimeIn: false, hasTimeOut: false };
  }

  const chunks = chunkArray(traineeIds, 30);
  for (const chunk of chunks) {
    const q = query(
      collection(db, 'attendance_records'),
      where('traineeId', 'in', chunk),
      where('timestamp', '>=', todayMs),
    );
    const snap = await getDocs(q);
    for (const doc of snap.docs) {
      const data = doc.data();
      const tid = data.traineeId as string;
      if (data.type === 'time_in') result[tid].hasTimeIn = true;
      if (data.type === 'time_out') result[tid].hasTimeOut = true;
    }
  }

  return result;
}
