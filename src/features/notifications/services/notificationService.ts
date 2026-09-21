import { getFunctionsInstancePublic, initializeFirebase } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import type {
  Notification,
  NotificationPreferences,
  SendFCMParams,
  SendFCMResult,
  ListNotificationsParams,
  PaginatedNotificationsResponse,
} from '../types';
import type { QueryConstraint } from 'firebase/firestore';

const LIST_FETCH_CAP = 500;

/** Register the Firebase messaging service worker. Returns the registration or null. */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('[FCM] Service worker registered');
    return registration;
  } catch (err) {
    console.error('[FCM] Service worker registration failed:', err);
    return null;
  }
}

/** Initialize FCM and request permission (call on app startup for authenticated users). */
export async function initializeFCM(): Promise<string | null> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('FCM not supported in this browser');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('FCM permission denied');
      return null;
    }

    const { getMessaging, getToken, deleteToken } = await import('firebase/messaging');
    const app = initializeFirebase();
    const messagingInstance = getMessaging(app);

    const vapidKey = import.meta.env.VITE_FIREBASE_FCM_VAPID_KEY;
    if (!vapidKey || vapidKey === 'your-vapid-key') {
      console.warn('VITE_FIREBASE_FCM_VAPID_KEY not set');
      return null;
    }

    // Register service worker and pass it to getToken()
    const swRegistration = await registerServiceWorker();
    if (!swRegistration) {
      console.warn('[FCM] No service worker registration');
      return null;
    }

    // Wait for the service worker to be active
    if (swRegistration.installing || swRegistration.waiting) {
      await new Promise<void>((resolve) => {
        const sw = swRegistration.installing || swRegistration.waiting;
        if (!sw) return resolve();
        sw.addEventListener('statechange', (e) => {
          if ((e.target as ServiceWorker).state === 'activated') resolve();
        });
      });
    }

    const tokenOptions = { vapidKey, serviceWorkerRegistration: swRegistration };

    try {
      const token = await getToken(messagingInstance, tokenOptions);
      if (token) {
        await saveFCMToken(token);
        console.log('FCM token registered:', token.slice(0, 20) + '...');
      }
      return token;
    } catch (getTokenErr) {
      // If getToken fails, try deleting stale token and retrying once
      console.warn('[FCM] getToken failed, clearing stale token and retrying:', getTokenErr);
      try {
        await deleteToken(messagingInstance);
      } catch {
        // Ignore deleteToken errors
      }
      const token = await getToken(messagingInstance, tokenOptions);
      if (token) {
        await saveFCMToken(token);
        console.log('FCM token registered (after retry):', token.slice(0, 20) + '...');
      }
      return token;
    }
  } catch (err) {
    console.error('FCM initialization failed:', err);
    return null;
  }
}

/** Save FCM token to Firestore. */
export async function saveFCMToken(token: string): Promise<void> {
  const { getAuthInstancePublic } = await import('@/config/firebase');
  const auth = getAuthInstancePublic();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

const { getFirestoreInstancePublic } = await import('@/config/firebase');
const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
const db = getFirestoreInstancePublic();

  await setDoc(doc(db, 'fcm_tokens', token), {
    userId: currentUser.uid,
    token,
    platform: 'web',
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Get user's FCM tokens. */
export async function getUserFCMTokens(userId: string): Promise<string[]> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const snap = await getDocs(query(collection(db, 'fcm_tokens'), where('userId', '==', userId), where('active', '==', true)));
  return snap.docs.map(d => d.id);
}

/** Send FCM notification via Cloud Function. */
export async function sendFCM(params: SendFCMParams): Promise<SendFCMResult> {
  const functions = getFunctionsInstancePublic();
  const sendFCMNotification = httpsCallable<SendFCMParams, SendFCMResult>(functions, 'sendFCMNotification');
  const result = await sendFCMNotification(params);
  return result.data;
}

/** Send notification to specific user (creates in-app + optionally FCM). */
export async function sendUserNotification(
  userId: string,
  type: Notification['type'],
  title: string,
  body: string,
  options: {
    data?: Record<string, string>;
    image?: string;
    priority?: Notification['priority'];
    sendFCM?: boolean;
  } = {},
): Promise<void> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  // Create in-app notification
  const notificationRef = await addDoc(collection(db, 'notifications'), {
    userId,
    type,
    title,
    body,
    data: options.data,
    image: options.image,
    priority: options.priority || 'normal',
    read: false,
    sentVia: options.sendFCM ? 'both' : 'in_app',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Optionally send FCM
  if (options.sendFCM) {
    const tokens = await getUserFCMTokens(userId);
    if (tokens.length > 0) {
      try {
await sendFCM({
            tokens,
            title,
            body,
            data: { ...options.data, notificationId: notificationRef.id },
            image: options.image,
            priority: options.priority === 'urgent' ? 'high' : 'normal',
          });
          // Update notification with FCM status
          const { getFirestoreInstancePublic } = await import('@/config/firebase');
          const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
          const db = getFirestoreInstancePublic();
          await updateDoc(doc(db, 'notifications', notificationRef.id), {
            sentVia: 'both',
            updatedAt: serverTimestamp(),
          });
      } catch (err) {
        console.error('FCM send failed, in-app notification still created:', err);
      }
    }
  }
}

/** Send notification to multiple users (e.g., all trainees in a company). */
export async function sendTopicNotification(
  topic: string,
  title: string,
  body: string,
  options: {
    data?: Record<string, string>;
    image?: string;
    priority?: Notification['priority'];
  } = {},
): Promise<void> {
  await sendFCM({
    topic,
    title,
    body,
    data: options.data,
    image: options.image,
    priority: options.priority === 'urgent' ? 'high' : 'normal',
  });
}

/** Get user's notifications with pagination. */
export async function listNotifications(params: ListNotificationsParams = {}): Promise<PaginatedNotificationsResponse> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
  const { getAuthInstancePublic } = await import('@/config/firebase');
  const auth = getAuthInstancePublic();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const db = getFirestoreInstancePublic();
  const page = params.page ?? 1;
  const pageLimit = params.limit ?? 20;

  const constraints: QueryConstraint[] = [where('userId', '==', currentUser.uid)];
  if (params.read !== undefined) constraints.push(where('read', '==', params.read));
  if (params.type) constraints.push(where('type', '==', params.type));
  if (params.priority) constraints.push(where('priority', '==', params.priority));

  constraints.push(orderBy('createdAt', 'desc'), limit(LIST_FETCH_CAP));

  const snap = await getDocs(query(collection(db, 'notifications'), ...constraints));
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));

  const unreadCount = all.filter(n => !n.read).length;
  const start = (page - 1) * pageLimit;

  return {
    data: all.slice(start, start + pageLimit),
    total: all.length,
    page,
    limit: pageLimit,
    totalPages: Math.max(1, Math.ceil(all.length / pageLimit)),
    unreadCount,
  };
}

/** Mark notification as read. */
export async function markNotificationRead(id: string): Promise<void> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  await updateDoc(doc(db, 'notifications', id), {
    read: true,
    readAt: Date.now(),
    updatedAt: serverTimestamp(),
  });
}

/** Mark all notifications as read. */
export async function markAllNotificationsRead(): Promise<void> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, getDocs, writeBatch, serverTimestamp } = await import('firebase/firestore');
  const { getAuthInstancePublic } = await import('@/config/firebase');
  const auth = getAuthInstancePublic();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const db = getFirestoreInstancePublic();
  const snap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', currentUser.uid), where('read', '==', false)));

  const batch = writeBatch(db);
  for (const doc of snap.docs) {
    batch.update(doc.ref, { read: true, readAt: Date.now(), updatedAt: serverTimestamp() });
  }
  await batch.commit();
}

/** Delete a notification. */
export async function deleteNotification(id: string): Promise<void> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { doc, getDoc, deleteDoc } = await import('firebase/firestore');
  const { getAuthInstancePublic } = await import('@/config/firebase');
  const auth = getAuthInstancePublic();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const db = getFirestoreInstancePublic();
  const ref = doc(db, 'notifications', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Notification not found');
  const data = snap.data();
  if (data.userId !== currentUser.uid) throw new Error('Not authorized');

  await deleteDoc(ref);
}

/** Get user notification preferences. */
export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { doc, getDoc } = await import('firebase/firestore');
  const { getAuthInstancePublic } = await import('@/config/firebase');
  const auth = getAuthInstancePublic();
  const currentUser = auth.currentUser;
  if (!currentUser) return null;

  const db = getFirestoreInstancePublic();
  const snap = await getDoc(doc(db, 'notification_preferences', currentUser.uid));
  return snap.exists() ? (snap.data() as NotificationPreferences) : null;
}

/** Update notification preferences. */
export async function updateNotificationPreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
  const { getAuthInstancePublic } = await import('@/config/firebase');
  const auth = getAuthInstancePublic();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const db = getFirestoreInstancePublic();
  await setDoc(doc(db, 'notification_preferences', currentUser.uid), {
    ...prefs,
    userId: currentUser.uid,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/** Default notification preferences. */
export function getDefaultPreferences(): NotificationPreferences {
  const allTypes: Notification['type'][] = [
    'task_created', 'task_updated', 'task_due_soon', 'task_overdue',
    'task_approved', 'task_returned', 'dtr_pending', 'dtr_approved',
    'dtr_rejected', 'document_pending', 'document_approved', 'document_rejected',
    'attendance_missing', 'qr_generated', 'leave_requested', 'leave_approved',
    'leave_rejected', 'system_announcement', 'other',
  ];

  return {
    userId: '',
    fcmEnabled: true,
    inAppEnabled: true,
    emailEnabled: false,
    types: Object.fromEntries(allTypes.map(t => [t, { fcm: true, inApp: true, email: false }])) as Record<Notification['type'], { fcm: boolean; inApp: boolean; email: boolean }>,
    updatedAt: Date.now(),
  };
}