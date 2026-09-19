/**
 * Firebase Blaze: direct Firestore CRUD for admin management.
 *
 * Previously this file called ~25 Cloud Functions callables (getUsers,
 * createUser, ...) that were never implemented and cannot deploy on the
 * Spark plan (Functions require Blaze). Every method below now talks to
 * Firestore directly; Security Rules remain the enforcement point (admin
 * writes, role-scoped reads). No component changes needed — same API.
 *
 * Notes / limitations:
 * - Auth accounts: created via a secondary FirebaseApp so the admin stays
 *   signed in. `createUser` writes the `users/{uid}` doc AND calls Edge
 *   `set_user_role` to set custom claims immediately. `AuthProvider` falls
 *   back to the doc role if claims are not yet available.
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
import { initializeFirebase, getFirestoreInstancePublic, getAuthInstancePublic, getFunctionsInstancePublic } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import type {
  User,
  Company,
  Department,
  Supervisor,
  Coordinator,
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
  placementType?: string;
  placementStatus?: string;
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
  COORDINATORS: 'coordinators',
  TRAINEES: 'trainees',
  WORK_SCHEDULES: 'work_schedules',
  OJT_SCHEDULES: 'ojt_schedules',
  AUDIT_LOGS: 'audit_logs',
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

/** Write audit log to Firestore directly (client SDK, admin-only per rules). */
async function writeAuditDirectly(
  action: string,
  entityType: string,
  entityId: string,
  userId: string,
  newValue?: Record<string, unknown>,
): Promise<void> {
  await addDoc(collection(getFirestoreInstancePublic(), COLLECTIONS.AUDIT_LOGS), {
    timestamp: serverTimestamp(),
    userId,
    action,
    entityType,
    entityId,
    originalValue: null,
    newValue: newValue ?? null,
    metadata: null,
  });
}

/**
 * Fire-and-forget audit: tries Edge `write_audit` first, falls back to
 * direct Firestore write if Edge is unavailable or fails.
 */
async function audit(
  action: string,
  entityType: string,
  entityId: string,
  newValue?: Record<string, unknown>,
): Promise<void> {
  const auth = getAuthInstancePublic();
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn('[audit] no current user, skipping');
    return;
  }

  // Use Cloud Function (server-side write via Admin SDK).
  try {
    const functions = getFunctionsInstancePublic();
    const writeAuditLog = httpsCallable(functions, 'writeAuditLog');
    await writeAuditLog({
      userId: currentUser.uid,
      action,
      entityType,
      entityId,
      newValue,
    });
    return;
  } catch (err) {
    console.warn('[audit] Cloud Function call failed, falling back to direct write:', err);
  }

  // Fallback: direct Firestore write (requires admin role per security rules).
  try {
    await writeAuditDirectly(action, entityType, entityId, currentUser.uid, newValue);
  } catch (err) {
    console.error('[audit] Direct Firestore write also failed:', err);
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
    // 3. Sync custom claims via Cloud Function `setUserRole` so the new user can log
    //    in immediately without waiting for a manual claims sync.
    try {
      const functions = getFunctionsInstancePublic();
      const setUserRole = httpsCallable(functions, 'setUserRole');
      await setUserRole({
        uid,
        role: data.role,
        ...(data.companyId ? { companyId: data.companyId } : {}),
        ...(data.departmentId ? { departmentId: data.departmentId } : {}),
        ...(data.supervisorId ? { supervisorId: data.supervisorId } : {}),
      });
    } catch (err) {
      console.error('[createUser] setUserRole Cloud Function call failed (claims not set):', err);
      // Non-fatal: AuthProvider falls back to the Firestore doc role.
    }
    audit('create', 'user', uid, { role: data.role, companyId: data.companyId });
    return this.getUser(uid);
  },

  async updateUser(uid: string, data: Partial<UserFormData>): Promise<User> {
    // Email/password cannot change other users' Auth accounts client-side.
    const editable: Record<string, unknown> = { ...data };
    delete editable.email;
    delete editable.password;

    // If role, company, department, supervisor, or trainee changed, sync via Cloud Function `setUserRole`.
    const shouldSyncClaims =
      typeof editable.role === 'string' ||
      editable.companyId !== undefined ||
      editable.departmentId !== undefined ||
      editable.supervisorId !== undefined ||
      editable.traineeId !== undefined;
    if (shouldSyncClaims) {
      try {
        const functions = getFunctionsInstancePublic();
        const setUserRole = httpsCallable(functions, 'setUserRole');
        const currentSnap = await getDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.USERS, uid));
        const currentData = (currentSnap.exists() ? currentSnap.data() : {}) as Record<string, unknown>;
        const effectiveRole = (editable.role as string) || (currentData.role as string);
        if (effectiveRole) {
          await setUserRole({
            uid,
            role: effectiveRole,
            companyId: (editable.companyId !== undefined ? editable.companyId : currentData.companyId) as string || undefined,
            departmentId: (editable.departmentId !== undefined ? editable.departmentId : currentData.departmentId) as string || undefined,
            supervisorId: (editable.supervisorId !== undefined ? editable.supervisorId : currentData.supervisorId) as string || undefined,
            traineeId: (editable.traineeId !== undefined ? editable.traineeId : currentData.traineeId) as string || undefined,
          });
        }
      } catch (err) {
        console.error('[updateUser] setUserRole Cloud Function call failed:', err);
        throw new Error('Failed to sync role or claims. Check Cloud Functions config and secrets.');
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
    const db = getFirestoreInstancePublic();

    // Delete Auth account via Cloud Function (client SDK can't delete other users)
    try {
      const functions = getFunctionsInstancePublic();
      const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');
      await deleteUserAccount({ uid });
    } catch (err) {
      console.error('[deleteUser] Cloud Function deleteUserAccount failed (Auth account still exists):', err);
    }

    // Delete corresponding supervisor/trainee records
    const [supervisorSnap, traineeSnap] = await Promise.all([
      getDocs(query(collection(db, COLLECTIONS.SUPERVISORS), where('userId', '==', uid))),
      getDocs(query(collection(db, COLLECTIONS.TRAINEES), where('userId', '==', uid))),
    ]);
    const batch = writeBatch(db);

    // Clean up assignedTrainees references before deleting trainee docs
    for (const traineeDoc of traineeSnap.docs) {
      const supSnap = await getDocs(
        query(collection(db, COLLECTIONS.SUPERVISORS), where('assignedTrainees', 'array-contains', traineeDoc.id)),
      );
      for (const supDoc of supSnap.docs) {
        batch.update(doc(db, COLLECTIONS.SUPERVISORS, supDoc.id), {
          assignedTrainees: arrayRemove(traineeDoc.id),
          updatedAt: serverTimestamp(),
        });
        batch.delete(doc(db, COLLECTIONS.SUPERVISORS, supDoc.id, 'assignedTrainees', traineeDoc.id));
      }
    }

    // Clean up supervisor's own assignedTrainees subcollection
    for (const supDoc of supervisorSnap.docs) {
      const assignedSnap = await getDocs(collection(db, COLLECTIONS.SUPERVISORS, supDoc.id, 'assignedTrainees'));
      for (const assignedDoc of assignedSnap.docs) {
        batch.delete(assignedDoc.ref);
      }
    }

    supervisorSnap.docs.forEach((d) => batch.delete(d.ref));
    traineeSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, COLLECTIONS.USERS, uid));
    await batch.commit();
    audit('delete', 'user', uid);
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
    const db = getFirestoreInstancePublic();
    // Check for related records
    const [departments, supervisors, trainees, workSchedules, ojtSchedules] = await Promise.all([
      getDocs(query(collection(db, COLLECTIONS.DEPARTMENTS), where('companyId', '==', id), limit(1))),
      getDocs(query(collection(db, COLLECTIONS.SUPERVISORS), where('companyId', '==', id), limit(1))),
      getDocs(query(collection(db, COLLECTIONS.TRAINEES), where('companyId', '==', id), limit(1))),
      getDocs(query(collection(db, COLLECTIONS.WORK_SCHEDULES), where('companyId', '==', id), limit(1))),
      getDocs(query(collection(db, COLLECTIONS.OJT_SCHEDULES), where('companyId', '==', id), limit(1))),
    ]);
    const deps: string[] = [];
    if (!departments.empty) deps.push('departments');
    if (!supervisors.empty) deps.push('supervisors');
    if (!trainees.empty) deps.push('trainees');
    if (!workSchedules.empty) deps.push('work schedules');
    if (!ojtSchedules.empty) deps.push('OJT schedules');
    if (deps.length > 0) {
      throw new Error(`Cannot delete company: it has related ${deps.join(', ')}. Remove them first.`);
    }
    await deleteDoc(doc(db, COLLECTIONS.COMPANIES, id));
    audit('delete', 'company', id);
  },

  async verifyCompany(companyId: string, verifiedBy: string): Promise<Company> {
    const db = getFirestoreInstancePublic();
    await updateDoc(doc(db, COLLECTIONS.COMPANIES, companyId), {
      verified: true,
      verifiedBy,
      verifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    audit('verify', 'company', companyId, { verifiedBy });
    return this.getCompany(companyId);
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
    const db = getFirestoreInstancePublic();
    // Check for related records
    const [supervisors, trainees] = await Promise.all([
      getDocs(query(collection(db, COLLECTIONS.SUPERVISORS), where('departmentId', '==', id), limit(1))),
      getDocs(query(collection(db, COLLECTIONS.TRAINEES), where('departmentId', '==', id), limit(1))),
    ]);
    const deps: string[] = [];
    if (!supervisors.empty) deps.push('supervisors');
    if (!trainees.empty) deps.push('trainees');
    if (deps.length > 0) {
      throw new Error(`Cannot delete department: it has related ${deps.join(', ')}. Remove them first.`);
    }
    await deleteDoc(doc(db, COLLECTIONS.DEPARTMENTS, id));
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

  async createSupervisor(data: { userId: string; companyId: string; departmentId: string }): Promise<Supervisor> {
    if (!data.userId || !data.companyId || !data.departmentId) {
      throw new Error('User, company, and department are required');
    }
    const db = getFirestoreInstancePublic();
    const supervisorDocId = data.userId;
    await setDoc(doc(db, COLLECTIONS.SUPERVISORS, supervisorDocId), {
      userId: data.userId,
      companyId: data.companyId,
      departmentId: data.departmentId,
      assignedTrainees: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update users doc so Firestore data is consistent
    await updateDoc(doc(db, COLLECTIONS.USERS, data.userId), {
      role: 'supervisor',
      companyId: data.companyId,
      departmentId: data.departmentId,
      supervisorId: supervisorDocId,
      updatedAt: serverTimestamp(),
    }).catch((err) => {
      console.warn('[createSupervisor] Could not update users doc:', err);
    });

    // Sync custom claims via Cloud Function `setUserRole`
    try {
      const functions = getFunctionsInstancePublic();
      const setUserRole = httpsCallable(functions, 'setUserRole');
      await setUserRole({
        uid: data.userId,
        role: 'supervisor',
        companyId: data.companyId,
        departmentId: data.departmentId,
        supervisorId: supervisorDocId,
      });
    } catch (err) {
      console.error('[createSupervisor] setUserRole Cloud Function call failed:', err);
      throw new Error('Failed to set supervisor custom claims. Please check Cloud Functions.');
    }

    audit('create', 'supervisor', supervisorDocId, { userId: data.userId, companyId: data.companyId });
    return this.getSupervisor(supervisorDocId);
  },

  async updateSupervisor(id: string, data: Partial<Pick<Supervisor, 'companyId' | 'departmentId'>>): Promise<Supervisor> {
    await updateDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.SUPERVISORS, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });

    if (data.companyId || data.departmentId) {
      await updateDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.USERS, id), {
        ...(data.companyId ? { companyId: data.companyId } : {}),
        ...(data.departmentId ? { departmentId: data.departmentId } : {}),
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);

      try {
        const functions = getFunctionsInstancePublic();
        const setUserRole = httpsCallable(functions, 'setUserRole');
        await setUserRole({
          uid: id,
          role: 'supervisor',
          ...(data.companyId ? { companyId: data.companyId } : {}),
          ...(data.departmentId ? { departmentId: data.departmentId } : {}),
          supervisorId: id,
        });
      } catch (err) {
        console.warn('[updateSupervisor] setUserRole sync failed:', err);
      }
    }

    audit('update', 'supervisor', id, data as Record<string, unknown>);
    return this.getSupervisor(id);
  },

  async getCoordinator(id: string): Promise<Coordinator> {
    return getOne<Coordinator>(COLLECTIONS.COORDINATORS, id, 'Coordinator');
  },

  async createCoordinator(data: { userId: string; companyId: string; departmentId: string }): Promise<Coordinator> {
    if (!data.userId || !data.companyId || !data.departmentId) {
      throw new Error('User, company, and department are required');
    }
    const db = getFirestoreInstancePublic();
    const coordinatorDocId = data.userId;
    await setDoc(doc(db, COLLECTIONS.COORDINATORS, coordinatorDocId), {
      userId: data.userId,
      companyId: data.companyId,
      departmentId: data.departmentId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update users doc so Firestore data is consistent
    await updateDoc(doc(db, COLLECTIONS.USERS, data.userId), {
      role: 'coordinator',
      companyId: data.companyId,
      departmentId: data.departmentId,
      updatedAt: serverTimestamp(),
    }).catch((err) => {
      console.warn('[createCoordinator] Could not update users doc:', err);
    });

    // Sync custom claims via Cloud Function `setUserRole`
    try {
      const functions = getFunctionsInstancePublic();
      const setUserRole = httpsCallable(functions, 'setUserRole');
      await setUserRole({
        uid: data.userId,
        role: 'coordinator',
        companyId: data.companyId,
        departmentId: data.departmentId,
      });
    } catch (err) {
      console.error('[createCoordinator] setUserRole Cloud Function call failed:', err);
      throw new Error('Failed to set coordinator custom claims. Please check Cloud Functions.');
    }

    audit('create', 'coordinator', coordinatorDocId, { userId: data.userId, companyId: data.companyId });
    return this.getCoordinator(coordinatorDocId);
  },

  async updateCoordinator(id: string, data: Partial<Pick<Coordinator, 'companyId' | 'departmentId'>>): Promise<Coordinator> {
    await updateDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.COORDINATORS, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });

    if (data.companyId || data.departmentId) {
      await updateDoc(doc(getFirestoreInstancePublic(), COLLECTIONS.USERS, id), {
        ...(data.companyId ? { companyId: data.companyId } : {}),
        ...(data.departmentId ? { departmentId: data.departmentId } : {}),
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);

      try {
        const functions = getFunctionsInstancePublic();
        const setUserRole = httpsCallable(functions, 'setUserRole');
        await setUserRole({
          uid: id,
          role: 'coordinator',
          ...(data.companyId ? { companyId: data.companyId } : {}),
          ...(data.departmentId ? { departmentId: data.departmentId } : {}),
        });
      } catch (err) {
        console.warn('[updateCoordinator] setUserRole sync failed:', err);
      }
    }

    audit('update', 'coordinator', id, data as Record<string, unknown>);
    return this.getCoordinator(id);
  },

  async assignTraineesToSupervisor(
    supervisorId: string,
    traineeIds: string[],
    unassignTraineeIds: string[] = [],
  ): Promise<void> {
    const db = getFirestoreInstancePublic();
    const supervisorRef = doc(db, COLLECTIONS.SUPERVISORS, supervisorId);

    // Unassign: remove from old supervisor's array + clear trainee's supervisorId
    for (let i = 0; i < unassignTraineeIds.length; i += 150) {
      const chunk = unassignTraineeIds.slice(i, i + 150);
      const batch = writeBatch(db);
      batch.update(supervisorRef, {
        assignedTrainees: arrayRemove(...chunk),
        updatedAt: serverTimestamp(),
      });
      for (const traineeId of chunk) {
        batch.delete(doc(db, COLLECTIONS.SUPERVISORS, supervisorId, 'assignedTrainees', traineeId));
        batch.update(doc(db, COLLECTIONS.TRAINEES, traineeId), {
          supervisorId: '',
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    // Assign: add to this supervisor's array + set trainee's supervisorId
    // First, remove trainees from any other supervisor before assigning here
    for (let i = 0; i < traineeIds.length; i += 150) {
      const chunk = traineeIds.slice(i, i + 150);

      // Find and clean up any old supervisors for these trainees
      for (const traineeId of chunk) {
        const traineeSnap = await getDoc(doc(db, COLLECTIONS.TRAINEES, traineeId));
        if (traineeSnap.exists()) {
          const traineeData = traineeSnap.data() as Record<string, unknown>;
          const oldSupervisorId = traineeData.supervisorId as string;
          if (oldSupervisorId && oldSupervisorId !== supervisorId) {
            const cleanupBatch = writeBatch(db);
            cleanupBatch.update(doc(db, COLLECTIONS.SUPERVISORS, oldSupervisorId), {
              assignedTrainees: arrayRemove(traineeId),
              updatedAt: serverTimestamp(),
            });
            cleanupBatch.delete(doc(db, COLLECTIONS.SUPERVISORS, oldSupervisorId, 'assignedTrainees', traineeId));
            await cleanupBatch.commit();
          }
        }
      }

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
    audit('assign', 'supervisor', supervisorId, { traineeIds, unassignTraineeIds });
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
    if (params.placementType) filters.push(['placementType', params.placementType]);
    if (params.placementStatus) filters.push(['placementStatus', params.placementStatus]);
    return listCollection<Trainee>(COLLECTIONS.TRAINEES, filters, ['userId'], params);
  },

  async getTrainee(id: string): Promise<Trainee> {
    return getOne<Trainee>(COLLECTIONS.TRAINEES, id, 'Trainee');
  },

  async updateTrainee(id: string, data: Partial<Trainee>): Promise<Trainee> {
    const db = getFirestoreInstancePublic();
    const editable: Record<string, unknown> = { ...data };
    delete editable.id;
    delete editable.createdAt;

    // If supervisorId changed, sync both supervisors' assignedTrainees
    if (data.supervisorId !== undefined) {
      const currentSnap = await getDoc(doc(db, COLLECTIONS.TRAINEES, id));
      const currentData = currentSnap.exists() ? currentSnap.data() as Record<string, unknown> : null;
      const oldSupervisorId = (currentData?.supervisorId as string) || '';
      const newSupervisorId = data.supervisorId || '';

      if (oldSupervisorId !== newSupervisorId) {
        const batch = writeBatch(db);

        // Remove from old supervisor
        if (oldSupervisorId) {
          batch.update(doc(db, COLLECTIONS.SUPERVISORS, oldSupervisorId), {
            assignedTrainees: arrayRemove(id),
            updatedAt: serverTimestamp(),
          });
          batch.delete(doc(db, COLLECTIONS.SUPERVISORS, oldSupervisorId, 'assignedTrainees', id));
        }

        // Add to new supervisor
        if (newSupervisorId) {
          batch.update(doc(db, COLLECTIONS.SUPERVISORS, newSupervisorId), {
            assignedTrainees: arrayUnion(id),
            updatedAt: serverTimestamp(),
          });
          batch.set(
            doc(db, COLLECTIONS.SUPERVISORS, newSupervisorId, 'assignedTrainees', id),
            { traineeId: id, assignedAt: serverTimestamp() },
            { merge: true },
          );
        }

        await batch.commit();
      }
    }

    await updateDoc(doc(db, COLLECTIONS.TRAINEES, id), {
      ...editable,
      updatedAt: serverTimestamp(),
    });

    if (data.supervisorId !== undefined || data.companyId !== undefined || data.departmentId !== undefined) {
      const traineeDoc = await getDoc(doc(db, COLLECTIONS.TRAINEES, id));
      const traineeData = (traineeDoc.exists() ? traineeDoc.data() : {}) as Record<string, unknown>;
      const userId = (traineeData?.userId as string) || '';
      if (userId) {
        await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
          ...(data.supervisorId !== undefined ? { supervisorId: data.supervisorId } : {}),
          ...(data.companyId !== undefined ? { companyId: data.companyId } : {}),
          ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);

        try {
          const functions = getFunctionsInstancePublic();
          const setUserRole = httpsCallable(functions, 'setUserRole');
          await setUserRole({
            uid: userId,
            role: 'trainee',
            traineeId: id,
            companyId: (data.companyId !== undefined ? data.companyId : traineeData?.companyId) as string || undefined,
            departmentId: (data.departmentId !== undefined ? data.departmentId : traineeData?.departmentId) as string || undefined,
            supervisorId: (data.supervisorId !== undefined ? data.supervisorId : traineeData?.supervisorId) as string || undefined,
          });
        } catch (err) {
          console.warn('[updateTrainee] setUserRole sync failed:', err);
        }
      }
    }

    audit('update', 'trainee', id, editable);
    return this.getTrainee(id);
  },

  async createTrainee(data: TraineeFormData): Promise<Trainee> {
    if (!data.userId || !data.companyId || !data.departmentId) {
      throw new Error('User, company, and department are required');
    }
    const db = getFirestoreInstancePublic();
    const ref = await addDoc(collection(db, COLLECTIONS.TRAINEES), {
      userId: data.userId,
      companyId: data.companyId,
      departmentId: data.departmentId,
      supervisorId: data.supervisorId || '',
      scheduleId: data.scheduleId || '',
      status: data.status || 'active',
      ojtStatus: data.ojtStatus || 'pending',
      placementType: data.placementType || 'internal',
      externalCompanyId: data.externalCompanyId || null,
      externalSupervisorId: data.externalSupervisorId || null,
      placementStatus: data.placementType === 'external' ? 'pending' : 'active',
      placementNotes: data.placementNotes || null,
      profile: data.profile || {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Back-link traineeId to the users doc so Firestore rules can resolve isAssignedTrainee()
    await updateDoc(doc(db, COLLECTIONS.USERS, data.userId), {
      role: 'trainee',
      companyId: data.companyId,
      departmentId: data.departmentId,
      traineeId: ref.id,
      ...(data.supervisorId ? { supervisorId: data.supervisorId } : {}),
      updatedAt: serverTimestamp(),
    });

    // Sync supervisor.assignedTrainees if supervisorId provided
    if (data.supervisorId) {
      const batch = writeBatch(db);
      batch.update(doc(db, COLLECTIONS.SUPERVISORS, data.supervisorId), {
        assignedTrainees: arrayUnion(ref.id),
        updatedAt: serverTimestamp(),
      });
      batch.set(
        doc(db, COLLECTIONS.SUPERVISORS, data.supervisorId, 'assignedTrainees', ref.id),
        { traineeId: ref.id, assignedAt: serverTimestamp() },
        { merge: true },
      );
      await batch.commit();
    }

    // Sync custom claims via Cloud Function `setUserRole` with traineeId
    try {
      const functions = getFunctionsInstancePublic();
      const setUserRole = httpsCallable(functions, 'setUserRole');
      await setUserRole({
        uid: data.userId,
        role: 'trainee',
        companyId: data.companyId,
        departmentId: data.departmentId,
        ...(data.supervisorId ? { supervisorId: data.supervisorId } : {}),
        traineeId: ref.id,
      });
    } catch (err) {
      console.error('[createTrainee] setUserRole Cloud Function call failed:', err);
      throw new Error('Failed to set trainee custom claims. Please check Cloud Functions.');
    }

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
    const db = getFirestoreInstancePublic();
    // Check for related OJT schedules
    const ojtSchedules = await getDocs(query(collection(db, COLLECTIONS.OJT_SCHEDULES), where('workScheduleId', '==', id), limit(1)));
    if (!ojtSchedules.empty) {
      throw new Error('Cannot delete work schedule: it is used by OJT schedules. Remove them first.');
    }
    await deleteDoc(doc(db, COLLECTIONS.WORK_SCHEDULES, id));
    audit('delete', 'work_schedule', id);
  },

  // OJT Schedules
  async listOJTSchedules(params: ListOJTSchedulesParams = {}): Promise<PaginatedResponse<OJTSchedule>> {
    const filters: [string, string][] = [];
    if (params.companyId) filters.push(['companyId', params.companyId]);
    if (params.status) filters.push(['status', params.status]);
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
