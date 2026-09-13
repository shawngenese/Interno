export type NotificationType =
  | 'task_created'
  | 'task_updated'
  | 'task_due_soon'
  | 'task_overdue'
  | 'task_approved'
  | 'task_returned'
  | 'dtr_pending'
  | 'dtr_approved'
  | 'dtr_rejected'
  | 'document_pending'
  | 'document_approved'
  | 'document_rejected'
  | 'attendance_missing'
  | 'qr_generated'
  | 'leave_requested'
  | 'leave_approved'
  | 'leave_rejected'
  | 'system_announcement'
  | 'other';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  image?: string;
  priority: NotificationPriority;
  read: boolean;
  readAt?: number;
  sentVia: 'fcm' | 'in_app' | 'both';
  fcmMessageId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface NotificationPreferences {
  userId: string;
  fcmEnabled: boolean;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  types: Record<NotificationType, { fcm: boolean; inApp: boolean; email: boolean }>;
  quietHoursStart?: string; // "22:00"
  quietHoursEnd?: string;   // "07:00"
  updatedAt: number;
}

export interface FCMToken {
  id: string;
  userId: string;
  token: string;
  platform: 'web' | 'android' | 'ios';
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SendFCMParams {
  tokens?: string[];
  topic?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  image?: string;
  priority?: 'high' | 'normal';
  ttl?: number;
}

export interface SendFCMResult {
  success: boolean;
  results: { success: number; failure: number };
  messageIds: string[];
  deduplicated?: boolean;
}

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
  read?: boolean;
  type?: NotificationType;
  priority?: NotificationPriority;
}

export interface PaginatedNotificationsResponse {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}