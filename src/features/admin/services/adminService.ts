import { httpsCallable, getFunctions as getFirebaseFunctions } from 'firebase/functions';
import { initializeFirebase } from '@/config/firebase';
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

function getCallable<TRequest, TResponse>(name: string) {
  const app = initializeFirebase();
  const funcs = getFirebaseFunctions(app, 'asia-southeast1');
  return httpsCallable<TRequest, TResponse>(funcs, name);
}

export const adminService = {
  // Users
  async listUsers(params: ListUsersParams = {}): Promise<PaginatedResponse<User>> {
    const callable = getCallable<ListUsersParams, { users: User[]; total: number }>('getUsers');
    const result = await callable(params);
    return {
      data: result.data.users,
      total: result.data.total,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: Math.ceil(result.data.total / (params.limit || 10)),
    };
  },

  async getUser(uid: string): Promise<User> {
    const callable = getCallable<{ uid: string }, { user: User }>('getUser');
    const result = await callable({ uid });
    return result.data.user;
  },

  async createUser(data: UserFormData): Promise<User> {
    const callable = getCallable<UserFormData, { user: User }>('createUser');
    const result = await callable(data);
    return result.data.user;
  },

  async updateUser(uid: string, data: Partial<UserFormData>): Promise<User> {
    const callable = getCallable<{ uid: string; data: Partial<UserFormData> }, { user: User }>('updateUser');
    const result = await callable({ uid, data });
    return result.data.user;
  },

  async archiveUser(uid: string): Promise<void> {
    const callable = getCallable<{ uid: string }, { success: boolean }>('archiveUser');
    await callable({ uid });
  },

  async restoreUser(uid: string): Promise<void> {
    const callable = getCallable<{ uid: string }, { success: boolean }>('restoreUser');
    await callable({ uid });
  },

  async deleteUser(uid: string): Promise<void> {
    const callable = getCallable<{ uid: string }, { success: boolean }>('deleteUser');
    await callable({ uid });
  },

  // Companies
  async listCompanies(params: ListCompaniesParams = {}): Promise<PaginatedResponse<Company>> {
    const callable = getCallable<ListCompaniesParams, { companies: Company[]; total: number }>('getCompanies');
    const result = await callable(params);
    return {
      data: result.data.companies,
      total: result.data.total,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: Math.ceil(result.data.total / (params.limit || 10)),
    };
  },

  async getCompany(id: string): Promise<Company> {
    const callable = getCallable<{ id: string }, { company: Company }>('getCompany');
    const result = await callable({ id });
    return result.data.company;
  },

  async createCompany(data: CompanyFormData): Promise<Company> {
    const callable = getCallable<CompanyFormData, { company: Company }>('createCompany');
    const result = await callable(data);
    return result.data.company;
  },

  async updateCompany(id: string, data: Partial<CompanyFormData>): Promise<Company> {
    const callable = getCallable<{ id: string; data: Partial<CompanyFormData> }, { company: Company }>('updateCompany');
    const result = await callable({ id, data });
    return result.data.company;
  },

  async deleteCompany(id: string): Promise<void> {
    const callable = getCallable<{ id: string }, { success: boolean }>('deleteCompany');
    await callable({ id });
  },

  // Departments
  async listDepartments(params: ListDepartmentsParams = {}): Promise<PaginatedResponse<Department>> {
    const callable = getCallable<ListDepartmentsParams, { departments: Department[]; total: number }>('getDepartments');
    const result = await callable(params);
    return {
      data: result.data.departments,
      total: result.data.total,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: Math.ceil(result.data.total / (params.limit || 10)),
    };
  },

  async getDepartment(id: string): Promise<Department> {
    const callable = getCallable<{ id: string }, { department: Department }>('getDepartment');
    const result = await callable({ id });
    return result.data.department;
  },

  async createDepartment(data: DepartmentFormData): Promise<Department> {
    const callable = getCallable<DepartmentFormData, { department: Department }>('createDepartment');
    const result = await callable(data);
    return result.data.department;
  },

  async updateDepartment(id: string, data: Partial<DepartmentFormData>): Promise<Department> {
    const callable = getCallable<{ id: string; data: Partial<DepartmentFormData> }, { department: Department }>('updateDepartment');
    const result = await callable({ id, data });
    return result.data.department;
  },

  async deleteDepartment(id: string): Promise<void> {
    const callable = getCallable<{ id: string }, { success: boolean }>('deleteDepartment');
    await callable({ id });
  },

  // Supervisors
  async listSupervisors(params: ListSupervisorsParams = {}): Promise<PaginatedResponse<Supervisor>> {
    const callable = getCallable<ListSupervisorsParams, { supervisors: Supervisor[]; total: number }>('getSupervisors');
    const result = await callable(params);
    return {
      data: result.data.supervisors,
      total: result.data.total,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: Math.ceil(result.data.total / (params.limit || 10)),
    };
  },

  async getSupervisor(id: string): Promise<Supervisor> {
    const callable = getCallable<{ id: string }, { supervisor: Supervisor }>('getSupervisor');
    const result = await callable({ id });
    return result.data.supervisor;
  },

  async assignTraineesToSupervisor(supervisorId: string, traineeIds: string[]): Promise<void> {
    const callable = getCallable<{ supervisorId: string; traineeIds: string[] }, { success: boolean }>('assignTraineesToSupervisor');
    await callable({ supervisorId, traineeIds });
  },

  async unassignTraineeFromSupervisor(supervisorId: string, traineeId: string): Promise<void> {
    const callable = getCallable<{ supervisorId: string; traineeId: string }, { success: boolean }>('unassignTraineeFromSupervisor');
    await callable({ supervisorId, traineeId });
  },

  // Trainees
  async listTrainees(params: ListTraineesParams = {}): Promise<PaginatedResponse<Trainee>> {
    const callable = getCallable<ListTraineesParams, { trainees: Trainee[]; total: number }>('getTrainees');
    const result = await callable(params);
    return {
      data: result.data.trainees,
      total: result.data.total,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: Math.ceil(result.data.total / (params.limit || 10)),
    };
  },

  async getTrainee(id: string): Promise<Trainee> {
    const callable = getCallable<{ id: string }, { trainee: Trainee }>('getTrainee');
    const result = await callable({ id });
    return result.data.trainee;
  },

  async updateTrainee(id: string, data: Partial<Trainee>): Promise<Trainee> {
    const callable = getCallable<{ id: string; data: Partial<Trainee> }, { trainee: Trainee }>('updateTrainee');
    const result = await callable({ id, data });
    return result.data.trainee;
  },

  // Work Schedules
  async listWorkSchedules(params: ListWorkSchedulesParams = {}): Promise<PaginatedResponse<WorkSchedule>> {
    const callable = getCallable<ListWorkSchedulesParams, { schedules: WorkSchedule[]; total: number }>('getWorkSchedules');
    const result = await callable(params);
    return {
      data: result.data.schedules,
      total: result.data.total,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: Math.ceil(result.data.total / (params.limit || 10)),
    };
  },

  async getWorkSchedule(id: string): Promise<WorkSchedule> {
    const callable = getCallable<{ id: string }, { schedule: WorkSchedule }>('getWorkSchedule');
    const result = await callable({ id });
    return result.data.schedule;
  },

  async createWorkSchedule(data: WorkScheduleFormData): Promise<WorkSchedule> {
    const callable = getCallable<WorkScheduleFormData, { schedule: WorkSchedule }>('createWorkSchedule');
    const result = await callable(data);
    return result.data.schedule;
  },

  async updateWorkSchedule(id: string, data: Partial<WorkScheduleFormData>): Promise<WorkSchedule> {
    const callable = getCallable<{ id: string; data: Partial<WorkScheduleFormData> }, { schedule: WorkSchedule }>('updateWorkSchedule');
    const result = await callable({ id, data });
    return result.data.schedule;
  },

  async deleteWorkSchedule(id: string): Promise<void> {
    const callable = getCallable<{ id: string }, { success: boolean }>('deleteWorkSchedule');
    await callable({ id });
  },

  // OJT Schedules
  async listOJTSchedules(params: ListOJTSchedulesParams = {}): Promise<PaginatedResponse<OJTSchedule>> {
    const callable = getCallable<ListOJTSchedulesParams, { schedules: OJTSchedule[]; total: number }>('getOJTSchedules');
    const result = await callable(params);
    return {
      data: result.data.schedules,
      total: result.data.total,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: Math.ceil(result.data.total / (params.limit || 10)),
    };
  },

  async getOJTSchedule(id: string): Promise<OJTSchedule> {
    const callable = getCallable<{ id: string }, { schedule: OJTSchedule }>('getOJTSchedule');
    const result = await callable({ id });
    return result.data.schedule;
  },

  async createOJTSchedule(data: OJTScheduleFormData): Promise<OJTSchedule> {
    const callable = getCallable<OJTScheduleFormData, { schedule: OJTSchedule }>('createOJTSchedule');
    const result = await callable(data);
    return result.data.schedule;
  },

  async updateOJTSchedule(id: string, data: Partial<OJTScheduleFormData>): Promise<OJTSchedule> {
    const callable = getCallable<{ id: string; data: Partial<OJTScheduleFormData> }, { schedule: OJTSchedule }>('updateOJTSchedule');
    const result = await callable({ id, data });
    return result.data.schedule;
  },

  async deleteOJTSchedule(id: string): Promise<void> {
    const callable = getCallable<{ id: string }, { success: boolean }>('deleteOJTSchedule');
    await callable({ id });
  },
};