import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App | undefined;
let adminAuth: Auth | undefined;
let adminDb: Firestore | undefined;
let adminStorage: Storage | undefined;

export function initializeAdminApp(): App {
  if (!adminApp) {
    adminApp = getApps().length > 0 ? getApps()[0] : initializeApp();
  }
  if (!adminAuth) {
    adminAuth = getAuth(adminApp);
  }
  if (!adminDb) {
    adminDb = getFirestore(adminApp);
    adminDb.settings({ ignoreUndefinedProperties: true });
  }
  if (!adminStorage) {
    adminStorage = getStorage(adminApp);
  }
  return adminApp;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) initializeAdminApp();
  return adminAuth!;
}

export function getAdminDb(): Firestore {
  if (!adminDb) initializeAdminApp();
  return adminDb!;
}

export function getAdminStorage(): Storage {
  if (!adminStorage) initializeAdminApp();
  return adminStorage!;
}

export const ROLES = ['admin', 'supervisor', 'coordinator', 'trainee'] as const;
export type UserRole = (typeof ROLES)[number];

export const QR_ACTIONS = ['time_in', 'time_out'] as const;
export type QRAction = (typeof QR_ACTIONS)[number];

export const QR_EXPIRATION_OPTIONS = [30, 60, 120, 300] as const;
export type QRExpirationSeconds = (typeof QR_EXPIRATION_OPTIONS)[number];

export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'archive',
  'restore',
  'scan',
  'approve',
  'reject',
  'assign',
  'unassign',
  'role_change',
  'document_upload',
  'document_delete',
  'dtr_generate',
  'dtr_approve',
  'dtr_reject',
  'dtr_correct',
  'leave_request',
  'leave_approve',
  'leave_reject',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const ENTITY_TYPES = [
  'user',
  'trainee',
  'supervisor',
  'company',
  'department',
  'attendance_record',
  'qr_session',
  'task',
  'document',
  'dtr',
  'leave_request',
  'audit_log',
  'notification',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const DEFAULT_QR_EXPIRATION: QRExpirationSeconds = 60;
export const MAX_FILE_SIZE_MB = 10;
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const COLLECTIONS = {
  USERS: 'users',
  TRAINEES: 'trainees',
  SUPERVISORS: 'supervisors',
  COMPANIES: 'companies',
  DEPARTMENTS: 'departments',
  ATTENDANCE_RECORDS: 'attendance_records',
  QR_SESSIONS: 'qr_sessions',
  TASKS: 'tasks',
  DOCUMENTS: 'documents',
  DTRS: 'dtrs',
  LEAVE_REQUESTS: 'leave_requests',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
  WORK_SCHEDULES: 'work_schedules',
  OJT_SCHEDULES: 'ojt_schedules',
  FCM_TOKENS: 'fcm_tokens',
  NOTIFICATIONS: 'notifications',
  NOTIFICATION_PREFERENCES: 'notification_preferences',
  TASK_COMMENTS: 'task_comments',
  TASK_DOCUMENTS: 'task_documents',
  TASK_APPROVALS: 'task_approvals',
  DTR_CORRECTION_REQUESTS: 'dtr_correction_requests',
  PROFILE_IMAGES: 'profile_images',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

initializeAdminApp();