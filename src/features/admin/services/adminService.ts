/**
 * C2 (Spark + Supabase Free): direct Firestore CRUD for admin management.
 *
 * Previously this file called ~25 Cloud Functions callables (getUsers,
 * createUser, ...) that were never implemented and cannot deploy on the
 * Spark plan (Functions require Blaze). Every method below now talks to
 * Firestore directly; Security Rules remain the enforcement point (admin
 * writes, role-scoped reads). No component changes needed — same API.
 *
 * Notes / limitations:
 * - Auth accounts: created via a secondary FirebaseApp so the admin stays
 *   signed in. Custom claims CANNOT be set client-side; `createUser` writes
 *   the `users/{uid}` doc role and claims sync later via Edge `set_user_role`
 *   or `assign-admin.cjs`. `AuthProvider` already falls back to the doc role.
 * - `deleteUser` removes the Firestore doc only; remove the Auth account in
 *   Console (Authentication > Users) or a future Edge function.
 * - Audit: `audit_logs` is client-write-blocked (`allow create:false`), so
 *   writes are staged for Edge `write_audit` (see `audit()` stub).
 * - Lists cap server fetch at 500 docs; search/sort/paginate client-side.
 *   Fine for thesis scale; add composite indexes + cursor pagination later.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser as deleteAuthUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp as FirestoreTimestamp,
  arrayUnion,
  arrayRemove,
  type QueryConstraint,
} from 'firebase/firestore';
import { initializeFirebase, getFirestoreInstancePublic, getAuthInstancePublic } from '@/config/firebase';
import { callEdgeFunction, isSupabaseConfigured } from '@/config/supabase';
import type {
  User,
  Company,
  Department,
  Supervisor,
  Trainee,
  WorkSchedule,
  OJTSchedule,
  UserFormData,
  CompanyFormData,
  DepartmentFormData,
  WorkScheduleFormData,
  OJTScheduleFormData,
  TraineeFormData,
} from '../types';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  role?: User['role'];
  status?: User['status'];
  companyId?: string;
  search?: string;
}

export interface ListCompaniesParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface ListDepartmentsParams {
  page?: number;
  limit?: number;
  companyId?: string;
  search?: string;
}

export interface ListTraineesParams {
  page?: number;
  limit?: number;
  status?: Trainee['status'];
  ojtStatus?: Trainee['ojtStatus'];
  companyId?: string;
  departmentId?: string;
  supervisorId?: string;
  search?: string;
}

export interface ListSupervisorsParams {
  page?: number;
  limit?: number;
  companyId?: string;
  departmentId?: string;
  search?: string;
}

export interface ListWorkSchedulesParams {
  page?: number;
  limit?: number;
  companyId?: string;
}

export interface ListOJTSchedulesParams {
  page?: number;
  limit?: number;
  companyId?: string;
}

const COLLECTIONS = {
  USERS: 'users',
  COMPANIES: 'companies',
  DEPARTMENTS: 'departments',
  SUPERVISORS: 'supervisors',
  TRAINEES: 'trainees',
  WORK_SCHEDULES: 'work_schedules',
  OJT_SCHEDULES: 'ojt_schedules',
} as const;

/** Server fetch cap per list call (Spark quota guard; paginate client-side). */
const LIST_FETCH_CAP = 500;

function toEntity<T>(id: string, data: Record<string, unknown>): T {
  return { id, ...data } as T;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function updatedSeconds(value: unknown): number {
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const seconds = (value as { seconds: unknown }).seconds;
    return typeof seconds === 'number' ? seconds : 0;
  }
  return 0;
}

/** Fire-and-forget audit via Edge `write_audit` (falls back to console if Supabase not configured). */
async function audit(
  action: string,
  entityType: string,
  entityId: string,
  newValue?: Record<string, unknown>,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.debug('[audit:staged]', { action, entityType, entityId, newValue });
    return;
  }
  try {
    const auth = getAuthInstancePublic();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.warn('[audit] no current user, skipping');
      return;
    }
    const idToken = await currentUser.getIdToken(true);
    await callEdgeFunction(
      'write_audit',
      {
        userId: currentUser.uid,
        action,
        entityType,
        entityId,
        newValue,
      },
      { idToken },
    );
  } catch (err) {
    console.error('[audit] Edge call failed, staged locally:', err);
  }
}

function paginate<T>(items: T[], page: number, pageLimit: number): PaginatedResponse<T> {
  const total = items.length;
  const start = (page - 1) * pageLimit;
  return {
    data: items.slice(start, start + pageLimit),
    total,
    page,
    limit: pageLimit,
    totalPages: Math.max(1, Math.ceil(total / pageLimit)),
  };
}

function applySearch<T>(items: T[], fields: (keyof T)[], search?: string): T[] {
  const term = (search ?? '').trim().toLowerCase();
  if (!term) return items;
  return items.filter((item) =>
    fields.some((field) => str(item[field]).toLowerCase().includes(term)),
  );
}

function sortByUpdatedDesc<T>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aUpdated = updatedSeconds((a as Record<string, unknown>).updatedAt);
    const bUpdated = updatedSeconds((b as Record<string, unknown>).updatedAt);
    return bUpdated - aUpdated;
  });
}

interface ListOptions {
  page?: number;
  limit?: number;
  search?: string;
}

async function listCollection<T>(
  collectionName: string,
  filters: [string, string][],
  searchFields: (keyof T)[],
  options: ListOptions,
): Promise<PaginatedResponse<T>> {
  const page = options.page ?? 1;
  const pageLimit = options.limit ?? 10;
  const constraints: QueryConstraint[] = filters.map(([field, value]) => where(field, '==', value));
  constraints.push(limit(LIST_FETCH_CAP));
  const snap = await getDocs(query(collection(getFirestoreInstancePublic(), collectionName), ...constraints));
  const items = snap.docs.map((d) => toEntity<T>(d.id, d.data() as Record<string, unknown>));
  const filtered = applySearch(items, searchFields, options.search);
  return paginate(sortByUpdatedDesc(filtered), page, pageLimit);
}

async function getOne<T>(collectionName: string, id: string, label: string): Promise<T> {
  const snap = await getDoc(doc(getFirestoreInstancePublic(), collectionName, id));
  if (!snap.exists()) throw new Error(`${label} not found`);
  return toEntity<T>(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * Secondary app Auth instance for provisioning users without signing the
 * admin out (client SDK has no "create other user" API).
 */
function getProvisioningAuth() {
  const primary = initializeFirebase();
  const name = 'user-provisioning';
  const existing: FirebaseApp | undefined = getApps().find((a) => a.name === name);
  const secondary = existing ?? initializeApp({ ...primary.options }, name);
  return getAuth(secondary);
}

function toDateInput(value: Date | { seconds: number }): Date {
  return value instanceof Date ? value : new Date(value.seconds * 1000);
}

export const adminService = {
  // Users
  async listUsers(params: ListUsersParams = {}): Promise<PaginatedResponse<User>> {
    const filters: [string, string][] = [];
    if (params.role) filters.push(['role', params.role]);
    if (params.status) filters.push(['status', params.status]);
    if (params.companyId) filters.push(['companyId', params.companyId]);
    return listCollection<User>(COLLECTIONS.USERS, filters, ['email', 'displayName'], params);
  },

  async getUser(uid: string): Promise<User> {
    return getOne<User>(COLLECTIONS.USERS, uid, 'User');
  },

  async createUser(data: UserFormData): Promise<User> {
    if (!data.email || !data.displayName || !data.role || !data.companyId) {
      throw new Error('Email, display name, role, and company are required');
    }
    if (!data.password || data.password.length < 6) {
      throw new Error('A password of at least 6 characters is required');
    }
    // 1. Auth account via provisioning app (admin session untouched).
    const provisioningAuth = getProvisioningAuth();
    const credential = await createUserWithEmailAndPassword(provisioningAuth, data.email, data.password);
    const uid = credential.user.uid;
    try {
      // 2. Firestore profile (rules: admin + keys email/role/displayName).
      await setDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.USERS, uid), {
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        companyId: data.companyId,
        ...(data.departmentId ? { departmentId: data.departmentId } : {}),
        ...(data.supervisorId ? { supervisorId: data.supervisorId } : {}),
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      // Avoid orphan Auth accounts: self-delete is allowed for the new user.
      await deleteAuthUser(credential.user).catch(() => undefined);
      throw error;
    } finally {
      await signOut(provisioningAuth).catch(() => undefined);
    }
    // Custom claims sync later via Edge `set_user_role` / assign-admin.cjs;
    // AuthProvider falls back to the doc role meanwhile.
    audit('create', 'user', uid, { role: data.role, companyId: data.companyId });
    return this.getUser(uid);
  },

  async updateUser(uid: string, data: Partial<UserFormData>): Promise<User> {
    // Email/password cannot change other users' Auth accounts client-side.
    const editable: Record<string, unknown> = { ...data };
    delete editable.email;
    delete editable.password;

    // If role is being changed, sync via Edge `set_user_role` (requires admin caller).
    const roleChanged = typeof editable.role === 'string';
    if (roleChanged && isSupabaseConfigured()) {
      try {
        const auth = getAuthInstancePublic();
        const currentUser = auth.currentUser;
        if (currentUser) {
          const idToken = await currentUser.getIdToken(true);
          await callEdgeFunction(
            'set_user_role',
            {
              uid,
              role: editable.role,
              ...(editable.companyId ? { companyId: editable.companyId } : {}),
              ...(editable.departmentId ? { departmentId: editable.departmentId } : {}),
              ...(editable.supervisorId ? { supervisorId: editable.supervisorId } : {}),
              ...(editable.traineeId ? { traineeId: editable.traineeId } : {}),
            },
            { idToken },
          );
        }
      } catch (err) {
        console.error('[updateUser] set_user_role Edge call failed:', err);
        throw new Error('Failed to sync role via Edge. Check Supabase config and secrets.');
      }
    }

    await updateDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.USERS, uid), {
      ...editable,
      updatedAt: serverTimestamp(),
    });
    audit('update', 'user', uid, editable);
    return this.getUser(uid);
  },

  async archiveUser(uid: string): Promise<void> {
    await updateDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.USERS, uid), {
      status: 'archived',
      updatedAt: serverTimestamp(),
    });
    audit('archive', 'user', uid);
  },

  async restoreUser(uid: string): Promise<void> {
    await updateDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.USERS, uid), {
      status: 'active',
      updatedAt: serverTimestamp(),
    });
    audit('restore', 'user', uid);
  },

  async deleteUser(uid: string): Promise<void> {
    // Permanent delete per AGENTS.md requires admin + audit; rules allow it.
    // Auth account must be removed separately in Console (client SDK cannot
    // delete other users).
    await deleteDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.USERS, uid));
    audit('delete', 'user', uid);
    console.warn(
      `[adminService] Firestore users/${uid} deleted. Also remove the Auth account in Console > Authentication > Users.`,
    );
  },

  // Companies
  async listCompanies(params: ListCompaniesParams = {}): Promise<PaginatedResponse<Company>> {
    return listCollection<Company>(COLLECTIONS.COMPANIES, [], ['name', 'contactEmail'], params);
  },

  async getCompany(id: string): Promise<Company> {
    return getOne<Company>(COLLECTIONS.COMPANIES, id, 'Company');
  },

  async createCompany(data: CompanyFormData): Promise<Company> {
    if (!data.name?.trim()) throw new Error('Company name is required');
    const ref = await addDoc(collection(getFirestoreInstancePublic(), COLLECTIONS.COMPANIES), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    audit('create', 'company', ref.id, { name: data.name });
    return this.getCompany(ref.id);
  },

  async updateCompany(id: string, data: Partial<CompanyFormData>): Promise<Company> {
    await updateDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.COMPANIES, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    audit('update', 'company', id, data as Record<string, unknown>);
    return this.getCompany(id);
  },

  async deleteCompany(id: string): Promise<void> {
    await deleteDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.COMPANIES, id));
    audit('delete', 'company', id);
  },

  // Departments
  async listDepartments(params: ListDepartmentsParams = {}): Promise<PaginatedResponse<Department>> {
    const filters: [string, string][] = [];
    if (params.companyId) filters.push(['companyId', params.companyId]);
    return listCollection<Department>(COLLECTIONS.DEPARTMENTS, filters, ['name'], params);
  },

  async getDepartment(id: string): Promise<Department> {
    return getOne<Department>(COLLECTIONS.DEPARTMENTS, id, 'Department');
  },

  async createDepartment(data: DepartmentFormData): Promise<Department> {
    if (!data.companyId || !data.name?.trim()) throw new Error('Company and department name are required');
    const ref = await addDoc(collection(getFirestoreInstancePublic(), COLLECTIONS.DEPARTMENTS), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    audit('create', 'department', ref.id, { name: data.name });
    return this.getDepartment(ref.id);
  },

  async updateDepartment(id: string, data: Partial<DepartmentFormData>): Promise<Department> {
    await updateDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.DEPARTMENTS, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    audit('update', 'department', id, data as Record<string, unknown>);
    return this.getDepartment(id);
  },

  async deleteDepartment(id: string): Promise<void> {
    await deleteDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.DEPARTMENTS, id));
    audit('delete', 'department', id);
  },

  // Supervisors
  async listSupervisors(params: ListSupervisorsParams = {}): Promise<PaginatedResponse<Supervisor>> {
    const filters: [string, string][] = [];
    if (params.companyId) filters.push(['companyId', params.companyId]);
    if (params.departmentId) filters.push(['departmentId', params.departmentId]);
    return listCollection<Supervisor>(COLLECTIONS.SUPERVISORS, filters, ['userId'], params);
  },

  async getSupervisor(id: string): Promise<Supervisor> {
    return getOne<Supervisor>(COLLECTIONS.SUPERVISORS, id, 'Supervisor');
  },

  async assignTraineesToSupervisor(supervisorId: string, traineeIds: string[]): Promise<void> {
    if (traineeIds.length === 0) return;
    const db = getFirestoreInstancePublic();
    const supervisorRef = doc(db, COLLECTIONS.SUPERVISORS, supervisorId);
    // WriteBatch caps at 500 ops; chunk by trainee (3 ops each).
    for (let i = 0; i < traineeIds.length; i += 150) {
      const chunk = traineeIds.slice(i, i + 150);
      const batch = writeBatch(db);
      batch.update(supervisorRef, {
        assignedTrainees: arrayUnion(...chunk),
        updatedAt: serverTimestamp(),
      });
      for (const traineeId of chunk) {
        batch.set(
          doc(db, COLLECTIONS.SUPERVISORS, supervisorId, 'assignedTrainees', traineeId),
          { traineeId, assignedAt: serverTimestamp() },
          { merge: true },
        );
        batch.update(doc(db, COLLECTIONS.TRAINEES, traineeId), {
          supervisorId,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    audit('assign', 'supervisor', supervisorId, { traineeIds });
  },

  async unassignTraineeFromSupervisor(supervisorId: string, traineeId: string): Promise<void> {
    const db = getFirestoreInstancePublic();
    const traineeSnap = await getDoc(doc(db, COLLECTIONS.TRAINEES, traineeId));
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTIONS.SUPERVISORS, supervisorId), {
      assignedTrainees: arrayRemove(traineeId),
      updatedAt: serverTimestamp(),
    });
    batch.delete(doc(db, COLLECTIONS.SUPERVISORS, supervisorId, 'assignedTrainees', traineeId));
    if (traineeSnap.exists() && (traineeSnap.data() as Record<string, unknown>).supervisorId === supervisorId) {
      batch.update(doc(db, COLLECTIONS.TRAINEES, traineeId), {
        supervisorId: '',
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    audit('unassign', 'supervisor', supervisorId, { traineeId });
  },

  // Trainees
  async listTrainees(params: ListTraineesParams = {}): Promise<PaginatedResponse<Trainee>> {
    const filters: [string, string][] = [];
    if (params.status) filters.push(['status', params.status]);
    if (params.ojtStatus) filters.push(['ojtStatus', params.ojtStatus]);
    if (params.companyId) filters.push(['companyId', params.companyId]);
    if (params.departmentId) filters.push(['departmentId', params.departmentId]);
    if (params.supervisorId) filters.push(['supervisorId', params.supervisorId]);
    return listCollection<Trainee>(COLLECTIONS.TRAINEES, filters, ['userId'], params);
  },

  async getTrainee(id: string): Promise<Trainee> {
    return getOne<Trainee>(COLLECTIONS.TRAINEES, id, 'Trainee');
  },

  async updateTrainee(id: string, data: Partial<Trainee>): Promise<Trainee> {
    const editable: Record<string, unknown> = { ...data };
    delete editable.id;
    delete editable.createdAt;
    await updateDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.TRAINEES, id), {
      ...editable,
      updatedAt: serverTimestamp(),
    });
    audit('update', 'trainee', id, editable);
    return this.getTrainee(id);
  },

  async createTrainee(data: TraineeFormData): Promise<Trainee> {
    if (!data.userId || !data.companyId || !data.departmentId) {
      throw new Error('User, company, and department are required');
    }
    const ref = await addDoc(collection(getFirestoreInstancePublic(), COLLECTIONS.TRAINEES), {
      userId: data.userId,
      companyId: data.companyId,
      departmentId: data.departmentId,
      supervisorId: data.supervisorId || '',
      scheduleId: data.scheduleId || '',
      status: data.status || 'active',
      ojtStatus: data.ojtStatus || 'pending',
      profile: data.profile || {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    audit('create', 'trainee', ref.id, { userId: data.userId, companyId: data.companyId });
    return this.getTrainee(ref.id);
  },

  async updateTraineeOJTStatus(id: string, ojtStatus: Trainee['ojtStatus']): Promise<Trainee> {
    await updateDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.TRAINEES, id), {
      ojtStatus,
      updatedAt: serverTimestamp(),
    });
    audit('update', 'trainee', id, { ojtStatus });
    return this.getTrainee(id);
  },

  // Work Schedules
  async listWorkSchedules(params: ListWorkSchedulesParams = {}): Promise<PaginatedResponse<WorkSchedule>> {
    const filters: [string, string][] = [];
    if (params.companyId) filters.push(['companyId', params.companyId]);
    return listCollection<WorkSchedule>(COLLECTIONS.WORK_SCHEDULES, filters, ['name'], params);
  },

  async getWorkSchedule(id: string): Promise<WorkSchedule> {
    return getOne<WorkSchedule>(COLLECTIONS.WORK_SCHEDULES, id, 'Work schedule');
  },

  async createWorkSchedule(data: WorkScheduleFormData): Promise<WorkSchedule> {
    if (!data.companyId || !data.name?.trim()) throw new Error('Company and schedule name are required');
    const ref = await addDoc(collection(getFirestoreInstancePublic(), COLLECTIONS.WORK_SCHEDULES), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    audit('create', 'work_schedule', ref.id, { name: data.name });
    return this.getWorkSchedule(ref.id);
  },

  async updateWorkSchedule(id: string, data: Partial<WorkScheduleFormData>): Promise<WorkSchedule> {
    await updateDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.WORK_SCHEDULES, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    audit('update', 'work_schedule', id, data as Record<string, unknown>);
    return this.getWorkSchedule(id);
  },

  async deleteWorkSchedule(id: string): Promise<void> {
    await deleteDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.WORK_SCHEDULES, id));
    audit('delete', 'work_schedule', id);
  },

  // OJT Schedules
  async listOJTSchedules(params: ListOJTSchedulesParams = {}): Promise<PaginatedResponse<OJTSchedule>> {
    const filters: [string, string][] = [];
    if (params.companyId) filters.push(['companyId', params.companyId]);
    return listCollection<OJTSchedule>(COLLECTIONS.OJT_SCHEDULES, filters, ['name'], params);
  },

  async getOJTSchedule(id: string): Promise<OJTSchedule> {
    return getOne<OJTSchedule>(COLLECTIONS.OJT_SCHEDULES, id, 'OJT schedule');
  },

  async createOJTSchedule(data: OJTScheduleFormData): Promise<OJTSchedule> {
    if (!data.companyId || !data.name?.trim()) throw new Error('Company and schedule name are required');
    const ref = await addDoc(collection(getFirestoreInstancePublic(), COLLECTIONS.OJT_SCHEDULES), {
      ...data,
      startDate: FirestoreTimestamp.fromDate(toDateInput(data.startDate)),
      endDate: FirestoreTimestamp.fromDate(toDateInput(data.endDate)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    audit('create', 'ojt_schedule', ref.id, { name: data.name });
    return this.getOJTSchedule(ref.id);
  },

  async updateOJTSchedule(id: string, data: Partial<OJTScheduleFormData>): Promise<OJTSchedule> {
    const { startDate, endDate, ...rest } = data;
    await updateDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.OJT_SCHEDULES, id), {
      ...rest,
      ...(startDate !== undefined
        ? { startDate: FirestoreTimestamp.fromDate(toDateInput(startDate)) }
        : {}),
      ...(endDate !== undefined ? { endDate: FirestoreTimestamp.fromDate(toDateInput(endDate)) } : {}),
      updatedAt: serverTimestamp(),
    });
    audit('update', 'ojt_schedule', id, data as unknown as Record<string, unknown>);
    return this.getOJTSchedule(id);
  },

  async deleteOJTSchedule(id: string): Promise<void> {
    await deleteDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.OJT_SCHEDULES, id));
    audit('delete', 'ojt_schedule', id);
  },
};
