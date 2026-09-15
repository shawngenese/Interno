import { getFirestoreInstancePublic } from '@/config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  orderBy,
  limit,
  serverTimestamp,
  getDoc,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import type {
  Task,
  TaskApproval,
  CreateTaskPayload,
  UpdateTaskPayload,
  SubmitTaskPayload,
  ReviewTaskPayload,
  TaskFilters,
  TaskStatus,
} from '../types';
import { notifyTaskCreated, notifyTaskApproved, notifyTaskReturned, notifyTaskSubmitted } from '@/features/notifications/services/notificationTriggers';
import { writeWithOfflineFallback } from '@/shared/utils/offline';

const COLLECTIONS = {
  TASKS: 'tasks',
  TASK_APPROVALS: 'task_approvals',
  USERS: 'users',
  TRAINEES: 'trainees',
} as const;

function toEntity<T>(id: string, data: Record<string, unknown>): T {
  return { id, ...data } as T;
}

/** Create a new task (supervisor/admin). */
export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const db = getFirestoreInstancePublic();
  const now = serverTimestamp();

  return writeWithOfflineFallback(
    async () => {
      const traineeSnap = await getDoc(doc(db, COLLECTIONS.TRAINEES, payload.traineeId));
      let traineeName = 'Trainee';
      if (traineeSnap.exists()) {
        const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, traineeSnap.data().userId));
        if (userSnap.exists()) {
          traineeName = (userSnap.data().displayName as string) || 'Trainee';
        }
      }

      const docRef = await addDoc(collection(db, COLLECTIONS.TASKS), {
        ...payload,
        traineeName,
        status: 'pending',
        progress: 0,
        returnCount: 0,
        createdAt: now,
        updatedAt: now,
      });

      const snap = await getDoc(docRef);
      const task = toEntity<Task>(docRef.id, snap.data() as Record<string, unknown>);

      // Trigger notification to trainee
      notifyTaskCreated(payload.traineeId, payload.title, docRef.id).catch(console.error);

      return task;
    },
    {
      type: 'create',
      collection: COLLECTIONS.TASKS,
      docId: `pending_${Date.now()}`,
      data: { ...payload, status: 'pending', progress: 0, returnCount: 0 },
    },
  );
}

/** Update a task (supervisor/admin). */
export async function updateTask(taskId: string, payload: UpdateTaskPayload): Promise<void> {
  const db = getFirestoreInstancePublic();
  const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
  return writeWithOfflineFallback(
    async () => {
      await updateDoc(taskRef, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    },
    {
      type: 'update',
      collection: COLLECTIONS.TASKS,
      docId: taskId,
      data: payload as unknown as Record<string, unknown>,
    },
  );
}

/** Delete a task (admin only). */
export async function deleteTask(taskId: string): Promise<void> {
  const db = getFirestoreInstancePublic();
  const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
  return writeWithOfflineFallback(
    async () => {
      await updateDoc(taskRef, {
        status: 'archived',
        updatedAt: serverTimestamp(),
      });
    },
    {
      type: 'update',
      collection: COLLECTIONS.TASKS,
      docId: taskId,
      data: { status: 'archived' },
    },
  );
}

/** Get a single task by ID. */
export async function getTask(taskId: string): Promise<Task | null> {
  const db = getFirestoreInstancePublic();
  const snap = await getDoc(doc(db, COLLECTIONS.TASKS, taskId));
  if (!snap.exists()) return null;
  return toEntity<Task>(snap.id, snap.data() as Record<string, unknown>);
}

/** List tasks with filters. */
export async function listTasks(
  filters: TaskFilters = {},
  options: { page?: number; limit?: number } = {},
): Promise<{ data: Task[]; total: number }> {
  const db = getFirestoreInstancePublic();
  const page = options.page ?? 1;
  const pageLimit = options.limit ?? 20;

  const constraints: ReturnType<typeof where>[] = [];

  if (filters.status && filters.status.length > 0) {
    if (filters.status.length === 1) {
      constraints.push(where('status', '==', filters.status[0]));
    }
  }

  if (filters.traineeId) {
    constraints.push(where('traineeId', '==', filters.traineeId));
  }

  if (filters.createdBy) {
    constraints.push(where('createdBy', '==', filters.createdBy));
  }

  const q = query(
    collection(db, COLLECTIONS.TASKS),
    ...constraints,
    orderBy('createdAt', 'desc'),
    limit(500),
  );

  const snap = await getDocs(q);
  let all = snap.docs.map((d) => toEntity<Task>(d.id, d.data() as Record<string, unknown>));

  if (filters.status && filters.status.length > 1) {
    all = all.filter((t) => filters.status!.includes(t.status));
  }

  if (filters.priority && filters.priority.length > 0) {
    all = all.filter((t) => filters.priority!.includes(t.priority));
  }

  if (filters.search) {
    const s = filters.search.toLowerCase();
    all = all.filter(
      (t) => t.title.toLowerCase().includes(s) || t.description.toLowerCase().includes(s),
    );
  }

  if (filters.dueDateFrom) {
    all = all.filter((t) => t.dueDate >= filters.dueDateFrom!);
  }

  if (filters.dueDateTo) {
    all = all.filter((t) => t.dueDate <= filters.dueDateTo!);
  }

  const total = all.length;
  const start = (page - 1) * pageLimit;
  return {
    data: all.slice(start, start + pageLimit),
    total,
  };
}

/** Trainee: update task status to in_progress. */
export async function startTask(taskId: string): Promise<void> {
  const db = getFirestoreInstancePublic();
  const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
  await writeWithOfflineFallback(
    () => updateDoc(taskRef, {
      status: 'in_progress',
      updatedAt: serverTimestamp(),
    }),
    { type: 'update', collection: COLLECTIONS.TASKS, docId: taskId, data: { status: 'in_progress' } },
  );
}

/** Trainee: submit task for review. */
export async function submitTask(taskId: string, payload: SubmitTaskPayload): Promise<void> {
  const db = getFirestoreInstancePublic();
  const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
  await writeWithOfflineFallback(
    () => updateDoc(taskRef, {
      status: 'submitted',
      submission: {
        text: payload.text,
        attachments: payload.attachments || [],
        submittedAt: Date.now(),
      },
      updatedAt: serverTimestamp(),
    }),
    { type: 'update', collection: COLLECTIONS.TASKS, docId: taskId, data: { status: 'submitted' } },
  );

  // Notify supervisor
  const taskSnap = await getDoc(taskRef);
  if (taskSnap.exists()) {
    const taskData = taskSnap.data();
    const traineeName = (taskData.traineeName as string) || 'Trainee';
    notifyTaskSubmitted(taskData.createdBy, traineeName, taskData.title, taskId).catch(console.error);
  }
}

/** Supervisor: approve or return task. */
export async function reviewTask(taskId: string, payload: ReviewTaskPayload): Promise<void> {
  const db = getFirestoreInstancePublic();
  const taskRef = doc(db, COLLECTIONS.TASKS, taskId);

  const updateData: Record<string, unknown> = {
    status: payload.action === 'approved' ? 'approved' : 'returned',
    feedback: payload.feedback,
    updatedAt: serverTimestamp(),
  };

  if (payload.action === 'approved') {
    updateData.approvedBy = (await import('@/config/firebase')).getAuthInstancePublic().currentUser?.uid;
    updateData.approvedAt = Date.now();
  } else {
    updateData.returnedBy = (await import('@/config/firebase')).getAuthInstancePublic().currentUser?.uid;
    updateData.returnedAt = Date.now();
    // Use transaction for atomic returnCount increment
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(taskRef);
      const currentReturnCount = snap.data()?.returnCount ?? 0;
      transaction.update(taskRef, { ...updateData, returnCount: currentReturnCount + 1 });
    });
    // Skip the writeWithOfflineFallback below since we already updated
    const taskSnap = await getDoc(taskRef);
    if (taskSnap.exists()) {
      const taskData = taskSnap.data();
      notifyTaskReturned(taskData.traineeId, taskData.title, taskId).catch(console.error);
    }
    return;
  }

  await writeWithOfflineFallback(
    () => updateDoc(taskRef, updateData),
    { type: 'update', collection: COLLECTIONS.TASKS, docId: taskId, data: updateData },
  );

  // Notify trainee
  const taskSnap = await getDoc(taskRef);
  if (taskSnap.exists()) {
    const taskData = taskSnap.data();
    if (payload.action === 'approved') {
      notifyTaskApproved(taskData.traineeId, taskData.title, taskId).catch(console.error);
    } else {
      notifyTaskReturned(taskData.traineeId, taskData.title, taskId).catch(console.error);
    }
  }

  const approvalRef = await addDoc(collection(db, COLLECTIONS.TASK_APPROVALS), {
    taskId,
    action: payload.action,
    performedBy: (await import('@/config/firebase')).getAuthInstancePublic().currentUser?.uid,
    feedback: payload.feedback,
    timestamp: Date.now(),
    createdAt: serverTimestamp(),
  });

  return approvalRef.id as unknown as void;
}

/** Get approval history for a task. */
export async function getTaskApprovals(taskId: string): Promise<TaskApproval[]> {
  const db = getFirestoreInstancePublic();
  const q = query(
    collection(db, COLLECTIONS.TASK_APPROVALS),
    where('taskId', '==', taskId),
    orderBy('timestamp', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toEntity<TaskApproval>(d.id, d.data() as Record<string, unknown>));
}

/** Supervisor: bulk approve tasks. */
export async function bulkReviewTasks(
  taskIds: string[],
  action: 'approved' | 'returned',
  feedback?: string,
): Promise<void> {
  const db = getFirestoreInstancePublic();
  const batch = writeBatch(db);

  const currentUser = (await import('@/config/firebase')).getAuthInstancePublic().currentUser;
  const now = Date.now();

  for (const taskId of taskIds) {
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    const updateData: Record<string, unknown> = {
      status: action === 'approved' ? 'approved' : 'returned',
      feedback,
      updatedAt: serverTimestamp(),
    };

    if (action === 'approved') {
      updateData.approvedBy = currentUser?.uid;
      updateData.approvedAt = now;
    } else {
      updateData.returnedBy = currentUser?.uid;
      updateData.returnedAt = now;
      const taskSnap = await getDoc(taskRef);
      const currentReturnCount = taskSnap.data()?.returnCount ?? 0;
      updateData.returnCount = currentReturnCount + 1;
    }

    batch.update(taskRef, updateData);

    const approvalRef = doc(collection(db, COLLECTIONS.TASK_APPROVALS));
    batch.set(approvalRef, {
      taskId,
      action,
      performedBy: currentUser?.uid,
      feedback,
      timestamp: now,
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

/** Get tasks assigned to a trainee. */
export async function getTraineeTasks(traineeId: string): Promise<Task[]> {
  const db = getFirestoreInstancePublic();
  const q = query(
    collection(db, COLLECTIONS.TASKS),
    where('traineeId', '==', traineeId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toEntity<Task>(d.id, d.data() as Record<string, unknown>));
}

/** Get task counts by status for a trainee. */
export async function getTraineeTaskCounts(
  traineeId: string,
): Promise<Record<TaskStatus, number>> {
  const db = getFirestoreInstancePublic();
  const q = query(
    collection(db, COLLECTIONS.TASKS),
    where('traineeId', '==', traineeId),
  );
  const snap = await getDocs(q);
  const counts: Record<TaskStatus, number> = {
    pending: 0,
    in_progress: 0,
    submitted: 0,
    approved: 0,
    returned: 0,
  };
  snap.docs.forEach((d) => {
    const status = d.data().status as TaskStatus;
    if (counts[status] !== undefined) {
      counts[status]++;
    }
  });
  return counts;
}

/** Add a comment to a task. */
export async function addComment(taskId: string, text: string, userId: string, attachments: string[] = []): Promise<void> {
  const db = getFirestoreInstancePublic();
  await addDoc(collection(db, 'task_comments'), {
    taskId,
    userId,
    text,
    attachments,
    createdAt: Date.now(),
  });
}

/** Get comments for a task. */
export async function getComments(taskId: string): Promise<import('../types').TaskComment[]> {
  const db = getFirestoreInstancePublic();
  const q = query(
    collection(db, 'task_comments'),
    where('taskId', '==', taskId),
    orderBy('createdAt', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as import('../types').TaskComment));
}
