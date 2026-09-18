import type { Timestamp } from '@/shared/types';

export type TaskStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'returned';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  companyId: string;
  title: string;
  description: string;
  traineeId: string;
  traineeName?: string;
  createdBy: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: number;
  startDate?: number;
  estimatedHours?: number;
  tags?: string[];
  attachments?: string[];
  requireAttachment: boolean;
  progress?: number;
  submission?: {
    text?: string;
    attachments?: string[];
    submittedAt: number;
  };
  feedback?: string;
  approvedBy?: string;
  approvedAt?: number;
  returnedBy?: string;
  returnedAt?: number;
  returnCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TaskApproval {
  id: string;
  taskId: string;
  action: 'approved' | 'returned';
  performedBy: string;
  feedback?: string;
  timestamp: number;
  createdAt: Timestamp;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  text: string;
  attachments?: string[];
  createdAt: number;
}

export interface CreateTaskPayload {
  title: string;
  description: string;
  traineeId: string;
  companyId: string;
  priority: TaskPriority;
  dueDate: number;
  startDate?: number;
  estimatedHours?: number;
  tags?: string[];
  requireAttachment: boolean;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: number;
  startDate?: number;
  estimatedHours?: number;
  tags?: string[];
  requireAttachment?: boolean;
}

export interface SubmitTaskPayload {
  text?: string;
  attachments?: string[];
}

export interface ReviewTaskPayload {
  action: 'approved' | 'returned';
  feedback?: string;
}

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  traineeId?: string;
  createdBy?: string;
  search?: string;
  dueDateFrom?: number;
  dueDateTo?: number;
}

export interface PaginatedTaskResponse {
  data: Task[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  approved: 'Approved',
  returned: 'Returned',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-[#EFEFEF] dark:bg-[#3A3A3A]', text: 'text-[#3A3A3A] dark:text-[#BDBDBD]' },
  in_progress: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  submitted: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
  approved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  returned: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, { bg: string; text: string }> = {
  low: { bg: 'bg-[#EFEFEF] dark:bg-[#3A3A3A]', text: 'text-[#555555] dark:text-[#9E9E9E]' },
  medium: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
  high: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
  urgent: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
};
