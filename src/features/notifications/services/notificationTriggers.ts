import { getFunctionsInstancePublic, getFirestoreInstancePublic } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import type { NotificationType, NotificationPriority } from '../types';

interface TriggerNotificationParams {
  type: NotificationType;
  title: string;
  body: string;
  targetUserId: string;
  data?: Record<string, string>;
  priority?: NotificationPriority;
}

/**
 * Send a notification (FCM + in-app) to a user.
 * Falls back to in-app only if FCM fails.
 */
export async function triggerNotification(params: TriggerNotificationParams): Promise<void> {
  const { type, title, body, targetUserId, data, priority = 'normal' } = params;

  try {
    const db = getFirestoreInstancePublic();

    // Check user notification preferences
    const prefsSnap = await getDocs(
      query(collection(db, 'notification_preferences'), where('userId', '==', targetUserId))
    );

    let sendFCM = true;
    let sendInApp = true;

    if (!prefsSnap.empty) {
      const prefs = prefsSnap.docs[0].data();
      sendFCM = prefs.fcmEnabled && prefs.types?.[type]?.fcm !== false;
      sendInApp = prefs.inAppEnabled && prefs.types?.[type]?.inApp !== false;

      // Check quiet hours
      if (prefs.quietHoursStart && prefs.quietHoursEnd) {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const currentTime = hours * 60 + minutes;

        const [startH, startM] = prefs.quietHoursStart.split(':').map(Number);
        const [endH, endM] = prefs.quietHoursEnd.split(':').map(Number);
        const startTime = startH * 60 + startM;
        const endTime = endH * 60 + endM;

        const inQuietHours = startTime > endTime
          ? currentTime >= startTime || currentTime < endTime
          : currentTime >= startTime && currentTime < endTime;

        if (inQuietHours && priority !== 'urgent') {
          sendFCM = false;
        }
      }
    }

    // Write in-app notification
    if (sendInApp) {
      await addDoc(collection(db, 'notifications'), {
        userId: targetUserId,
        type,
        title,
        body,
        data: data || {},
        priority,
        read: false,
        sentVia: sendFCM ? 'both' : 'in_app',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Send FCM
    if (sendFCM) {
      try {
        const tokensSnap = await getDocs(
          query(
            collection(db, 'fcm_tokens'),
            where('userId', '==', targetUserId),
            where('active', '==', true),
          )
        );

        if (!tokensSnap.empty) {
          const tokens = tokensSnap.docs.map((d) => d.data().token);

          const functions = getFunctionsInstancePublic();
          const sendFCMNotification = httpsCallable(functions, 'sendFCMNotification');
          await sendFCMNotification({
            tokens,
            title,
            body,
            data,
            priority: priority === 'urgent' ? 'high' : 'normal',
          });
        }
      } catch (err) {
        console.error('FCM send failed (in-app saved):', err);
      }
    }
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

async function getUserByTraineeId(traineeId: string): Promise<{ userId: string } | null> {
  const db = getFirestoreInstancePublic();
  const snap = await getDoc(doc(db, 'trainees', traineeId));
  if (!snap.exists()) return null;
  return snap.data() as { userId: string };
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
