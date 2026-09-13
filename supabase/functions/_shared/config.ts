/**
 * Shared Firebase Admin SDK initialization for Supabase Edge Functions.
 *
 * Secrets (set in Supabase Dashboard > Edge Functions > Secrets):
 * - FIREBASE_SERVICE_ACCOUNT: full service account JSON (one line)
 *
 * The service account must have:
 * - firebaseauth.users.update (for setCustomUserClaims)
 * - datastore.documents.create/update/delete (for Firestore writes)
 */
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;

export function initAdmin(): void {
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp);
    return;
  }

  const svc = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!svc) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT secret not set');
  }
  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(svc);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }

  adminApp = initializeApp({ credential: cert(serviceAccount) });
  adminAuth = getAuth(adminApp);
  adminDb = getFirestore(adminApp);
}

export function getAuthInstance(): Auth {
  if (!adminAuth) initAdmin();
  return adminAuth;
}

export function getDbInstance(): Firestore {
  if (!adminDb) initAdmin();
  return adminDb;
}

export const ROLES = ['admin', 'supervisor', 'coordinator', 'trainee'] as const;
export type UserRole = (typeof ROLES)[number];

export const AUDIT_ACTIONS = [
  'create', 'update', 'delete', 'archive', 'restore',
  'scan', 'approve', 'reject', 'assign', 'unassign',
  'role_change', 'document_upload', 'document_delete',
  'dtr_generate', 'dtr_approve', 'dtr_reject', 'dtr_correct',
  'leave_request', 'leave_approve', 'leave_reject',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const ENTITY_TYPES = [
  'user', 'trainee', 'supervisor', 'company', 'department',
  'attendance_record', 'qr_session', 'task', 'document',
  'dtr', 'leave_request', 'audit_log',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

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
} as const;