import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import type {
  CoordinatorTrainee,
  CoordinatorAttendanceSummary,
  CoordinatorTaskSummary,
  CoordinatorDocumentSummary,
  CoordinatorDashboardData,
} from '../types';

const FIRESTORE_IN_MAX = 30;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Get trainees assigned to a coordinator (via supervisorId or companyId). */
export async function getCoordinatorTrainees(_coordinatorId: string, companyId: string): Promise<CoordinatorTrainee[]> {
  const db = getFirestoreInstancePublic();

  const traineeSnap = await getDocs(
    query(
      collection(db, 'trainees'),
      where('companyId', '==', companyId),
      where('status', 'in', ['active', 'completed']),
    ),
  );

  const userIds = [...new Set(traineeSnap.docs.map((d) => d.data().userId).filter(Boolean))];

  const userMap = new Map<string, Record<string, unknown>>();
  for (const batch of chunk(userIds, FIRESTORE_IN_MAX)) {
    const userSnap = await getDocs(
      query(collection(db, 'users'), where(documentId(), 'in', batch)),
    );
    userSnap.docs.forEach((doc) => userMap.set(doc.id, doc.data()));
  }

  return traineeSnap.docs.map((doc) => {
    const data = doc.data();
    const userData = userMap.get(data.userId) ?? null;

    return {
      traineeId: doc.id,
      userId: data.userId || '',
      name: data.name || (userData?.displayName as string) || 'Unknown',
      email: (userData?.email as string) || '',
      departmentId: data.departmentId,
      supervisorId: data.supervisorId,
      companyId: data.companyId,
      status: data.status || 'active',
      startDate: data.startDate,
      endDate: data.endDate,
      ojtHoursRequired: data.ojtHoursRequired || 480,
      ojtHoursCompleted: data.ojtHoursCompleted || 0,
    };
  });
}

/** Get attendance summary for trainees in a company. */
export async function getAttendanceSummary(
  companyId: string,
  startDate: number,
  endDate: number,
): Promise<CoordinatorAttendanceSummary[]> {
  const db = getFirestoreInstancePublic();

  const traineeSnap = await getDocs(
    query(collection(db, 'trainees'), where('companyId', '==', companyId), where('status', '==', 'active')),
  );

  const traineeIds = traineeSnap.docs.map((d) => d.id);
  const traineeNameMap = new Map<string, string>();
  traineeSnap.docs.forEach((d) => traineeNameMap.set(d.id, d.data().name || 'Unknown'));

  // Batch fetch all DTRs across all trainees
  const dtrCounts = new Map<string, { presentDays: number; lateDays: number; totalRegular: number; totalOvertime: number; totalLate: number; totalUndertime: number }>();

  for (const batch of chunk(traineeIds, FIRESTORE_IN_MAX)) {
    const dtrSnap = await getDocs(
      query(
        collection(db, 'dtrs'),
        where('traineeId', 'in', batch),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
      ),
    );

    dtrSnap.docs.forEach((doc) => {
      const d = doc.data();
      const tid = d.traineeId as string;
      const acc = dtrCounts.get(tid) ?? { presentDays: 0, lateDays: 0, totalRegular: 0, totalOvertime: 0, totalLate: 0, totalUndertime: 0 };
      if (d.actualTimeIn) acc.presentDays++;
      if ((d.lateMinutes || 0) > 0) acc.lateDays++;
      acc.totalRegular += (d.regularMinutes || 0) / 60;
      acc.totalOvertime += (d.overtimeMinutes || 0) / 60;
      acc.totalLate += d.lateMinutes || 0;
      acc.totalUndertime += d.undertimeMinutes || 0;
      dtrCounts.set(tid, acc);
    });
  }

  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

  return traineeIds.map((traineeId) => {
    const acc = dtrCounts.get(traineeId) ?? { presentDays: 0, lateDays: 0, totalRegular: 0, totalOvertime: 0, totalLate: 0, totalUndertime: 0 };
    return {
      traineeId,
      traineeName: traineeNameMap.get(traineeId) || 'Unknown',
      totalDays,
      presentDays: acc.presentDays,
      lateDays: acc.lateDays,
      absentDays: Math.max(0, totalDays - acc.presentDays),
      totalRegularHours: Number(acc.totalRegular.toFixed(1)),
      totalOvertimeHours: Number(acc.totalOvertime.toFixed(1)),
      totalLateMinutes: acc.totalLate,
      totalUndertimeMinutes: acc.totalUndertime,
    };
  });
}

/** Get task summary for trainees in a company. */
export async function getTaskSummary(companyId: string): Promise<CoordinatorTaskSummary[]> {
  const db = getFirestoreInstancePublic();

  const traineeSnap = await getDocs(
    query(collection(db, 'trainees'), where('companyId', '==', companyId), where('status', '==', 'active')),
  );

  const traineeIds = traineeSnap.docs.map((d) => d.id);
  const traineeNameMap = new Map<string, string>();
  traineeSnap.docs.forEach((d) => traineeNameMap.set(d.id, d.data().name || 'Unknown'));

  const taskCounts = new Map<string, {
    totalTasks: number; pendingTasks: number; inProgressTasks: number;
    submittedTasks: number; approvedTasks: number; returnedTasks: number; overdueTasks: number;
  }>();

  const now = Date.now();

  for (const batch of chunk(traineeIds, FIRESTORE_IN_MAX)) {
    const taskSnap = await getDocs(
      query(collection(db, 'tasks'), where('traineeId', 'in', batch)),
    );

    taskSnap.docs.forEach((doc) => {
      const task = doc.data();
      const tid = task.traineeId as string;
      const acc = taskCounts.get(tid) ?? { totalTasks: 0, pendingTasks: 0, inProgressTasks: 0, submittedTasks: 0, approvedTasks: 0, returnedTasks: 0, overdueTasks: 0 };
      acc.totalTasks++;
      switch (task.status) {
        case 'pending': acc.pendingTasks++; break;
        case 'in_progress': acc.inProgressTasks++; break;
        case 'submitted': acc.submittedTasks++; break;
        case 'approved': acc.approvedTasks++; break;
        case 'returned': acc.returnedTasks++; break;
      }
      if (task.dueDate && task.dueDate < now && task.status !== 'approved') {
        acc.overdueTasks++;
      }
      taskCounts.set(tid, acc);
    });
  }

  return traineeIds.map((traineeId) => ({
    traineeId,
    traineeName: traineeNameMap.get(traineeId) || 'Unknown',
    ...(taskCounts.get(traineeId) ?? { totalTasks: 0, pendingTasks: 0, inProgressTasks: 0, submittedTasks: 0, approvedTasks: 0, returnedTasks: 0, overdueTasks: 0 }),
  }));
}

/** Get document summary for trainees in a company. */
export async function getDocumentSummary(companyId: string): Promise<CoordinatorDocumentSummary[]> {
  const db = getFirestoreInstancePublic();

  const traineeSnap = await getDocs(
    query(collection(db, 'trainees'), where('companyId', '==', companyId), where('status', '==', 'active')),
  );

  const traineeIds = traineeSnap.docs.map((d) => d.id);
  const traineeNameMap = new Map<string, string>();
  traineeSnap.docs.forEach((d) => traineeNameMap.set(d.id, d.data().name || 'Unknown'));

  const requiredDocs = ['resume', 'endorsement_letter', 'performance_evaluation', 'final_evaluation'];

  const docAccum = new Map<string, { pending: number; approved: number; rejected: number; uploadedTypes: Set<string>; total: number }>();

  for (const batch of chunk(traineeIds, FIRESTORE_IN_MAX)) {
    const docSnap = await getDocs(
      query(collection(db, 'documents'), where('traineeId', 'in', batch)),
    );

    docSnap.docs.forEach((doc) => {
      const d = doc.data();
      const tid = d.traineeId as string;
      const acc = docAccum.get(tid) ?? { pending: 0, approved: 0, rejected: 0, uploadedTypes: new Set<string>(), total: 0 };
      acc.total++;
      acc.uploadedTypes.add(d.type);
      switch (d.status) {
        case 'pending': acc.pending++; break;
        case 'approved': acc.approved++; break;
        case 'rejected': acc.rejected++; break;
      }
      docAccum.set(tid, acc);
    });
  }

  return traineeIds.map((traineeId) => {
    const acc = docAccum.get(traineeId) ?? { pending: 0, approved: 0, rejected: 0, uploadedTypes: new Set<string>(), total: 0 };
    return {
      traineeId,
      traineeName: traineeNameMap.get(traineeId) || 'Unknown',
      totalDocuments: acc.total,
      pendingDocuments: acc.pending,
      approvedDocuments: acc.approved,
      rejectedDocuments: acc.rejected,
      missingRequired: requiredDocs.filter((type) => !acc.uploadedTypes.has(type)),
    };
  });
}

/** Get OJT progress for trainees in a company. */
export async function getOJTProgress(companyId: string): Promise<CoordinatorDashboardData['ojtProgress']> {
  const db = getFirestoreInstancePublic();

  const traineeSnap = await getDocs(
    query(collection(db, 'trainees'), where('companyId', '==', companyId), where('status', '==', 'active')),
  );

  const progress: CoordinatorDashboardData['ojtProgress'] = [];

  for (const traineeDoc of traineeSnap.docs) {
    const traineeData = traineeDoc.data();
    const required = traineeData.ojtHoursRequired || 480;
    const completed = traineeData.ojtHoursCompleted || 0;

    progress.push({
      traineeId: traineeDoc.id,
      traineeName: traineeData.name || 'Unknown',
      required,
      completed,
      remaining: Math.max(0, required - completed),
      percentComplete: Math.min(100, Math.round((completed / required) * 100)),
    });
  }

  return progress;
}

/** Get full coordinator dashboard data. */
export async function getCoordinatorDashboardData(
  coordinatorId: string,
  companyId: string,
  startDate: number,
  endDate: number,
): Promise<CoordinatorDashboardData> {
  const [trainees, attendance, tasks, documents, ojtProgress] = await Promise.all([
    getCoordinatorTrainees(coordinatorId, companyId),
    getAttendanceSummary(companyId, startDate, endDate),
    getTaskSummary(companyId),
    getDocumentSummary(companyId),
    getOJTProgress(companyId),
  ]);

  return { trainees, attendance, tasks, documents, ojtProgress };
}
