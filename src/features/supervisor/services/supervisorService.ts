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
  const q = query(
    collection(db, COLLECTIONS.SUPERVISORS),
    where('userId', '==', userId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return toEntity<Supervisor>(docSnap.id, docSnap.data() as Record<string, unknown>);
}

/** Get trainees assigned to a supervisor. */
export async function getAssignedTrainees(supervisorId: string): Promise<Trainee[]> {
  const db = getFirestoreInstancePublic();
  const q = query(
    collection(db, COLLECTIONS.TRAINEES),
    where('supervisorId', '==', supervisorId),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => toEntity<Trainee>(d.id, d.data() as Record<string, unknown>));
}

/** Get pending DTRs for trainees assigned to a supervisor. */
export async function getPendingDTRs(traineeIds: string[]): Promise<DTREntry[]> {
  if (traineeIds.length === 0) return [];
  const db = getFirestoreInstancePublic();
  const q = query(
    collection(db, COLLECTIONS.DTRS),
    where('traineeId', 'in', traineeIds),
    where('status', '==', 'pending'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => toEntity<DTREntry>(d.id, d.data() as Record<string, unknown>));
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

  for (const traineeId of traineeIds) {
    const q = query(
      collection(db, 'attendance_records'),
      where('traineeId', '==', traineeId),
      where('timestamp', '>=', todayMs),
    );
    const snap = await getDocs(q);
    const records = snap.docs.map(d => d.data());
    result[traineeId] = {
      hasTimeIn: records.some(r => r.type === 'time_in'),
      hasTimeOut: records.some(r => r.type === 'time_out'),
    };
  }

  return result;
}
