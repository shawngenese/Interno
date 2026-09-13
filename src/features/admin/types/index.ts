import type { Timestamp } from '@/shared/types';

export type UserRole = 'admin' | 'supervisor' | 'coordinator' | 'trainee';

export type AccountStatus = 'pending' | 'active' | 'inactive' | 'archived';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  companyId: string;
  departmentId?: string;
  supervisorId?: string;
  traineeId?: string;
  status: AccountStatus;
  photoURL?: string;
  preferences?: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Company {
  id: string;
  name: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  settings?: {
    qrExpirationSeconds?: number;
    workHoursPerDay?: number;
    workDaysPerWeek?: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  headSupervisorId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Supervisor {
  id: string;
  userId: string;
  companyId: string;
  departmentId: string;
  assignedTrainees?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Trainee {
  id: string;
  userId: string;
  companyId: string;
  departmentId: string;
  supervisorId?: string;
  scheduleId?: string;
  status: AccountStatus;
  ojtStatus: 'pending' | 'active' | 'on_leave' | 'completed' | 'terminated' | 'archived';
  profile?: {
    studentId?: string;
    course?: string;
    school?: string;
    yearLevel?: string;
    emergencyContact?: {
      name: string;
      relationship: string;
      phone: string;
    };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkSchedule {
  id: string;
  companyId: string;
  name: string;
  timeIn: string;
  timeOut: string;
  breakDurationMinutes: number;
  workDays: number[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OJTSchedule {
  id: string;
  companyId: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  requiredHours: number;
  workScheduleId: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserFormData {
  email: string;
  displayName: string;
  role: UserRole;
  companyId: string;
  departmentId?: string;
  supervisorId?: string;
  password?: string;
}

export interface CompanyFormData {
  name: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface DepartmentFormData {
  companyId: string;
  name: string;
  description?: string;
  headSupervisorId?: string;
}

export interface WorkScheduleFormData {
  companyId: string;
  name: string;
  timeIn: string;
  timeOut: string;
  breakDurationMinutes: number;
  workDays: number[];
}

export interface OJTScheduleFormData {
  companyId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  requiredHours: number;
  workScheduleId: string;
  description?: string;
}

export interface TraineeFormData {
  userId: string;
  companyId: string;
  departmentId: string;
  supervisorId?: string;
  scheduleId?: string;
  status: AccountStatus;
  ojtStatus: Trainee['ojtStatus'];
  profile?: {
    studentId?: string;
    course?: string;
    school?: string;
    yearLevel?: string;
    emergencyContact?: {
      name: string;
      relationship: string;
      phone: string;
    };
  };
}

export interface SupervisorTraineeAssignment {
  supervisorId: string;
  traineeIds: string[];
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
  search?: string;
}

export interface ListOJTSchedulesParams {
  page?: number;
  limit?: number;
  companyId?: string;
  search?: string;
}