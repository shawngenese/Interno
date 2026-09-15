export type LeaveType = 'sick' | 'emergency' | 'personal' | 'school_activity' | 'company_holiday' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  traineeId: string;
  companyId: string;
  type: LeaveType;
  startDate: number;
  endDate: number;
  reason: string;
  attachmentUrl?: string;
  status: LeaveStatus;
  approvedBy?: string;
  approvedAt?: number;
  approvalNotes?: string;
  cancelledAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface LeaveFormValues {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface ListLeaveParams {
  page?: number;
  limit?: number;
  traineeId?: string;
  status?: LeaveStatus;
  type?: LeaveType;
  startDate?: number;
  endDate?: number;
  companyId?: string;
}

export interface PaginatedLeaveResponse {
  data: LeaveRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
