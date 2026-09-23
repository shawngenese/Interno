import type { Timestamp } from '@/shared/types';

export type TaskStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'returned' | 'archived';

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
  content: string;
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
  traineeIds?: string[];
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
  archived: 'Archived',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-muted border border-border', text: 'text-muted-foreground' },
  in_progress: { bg: 'bg-primary/15 border border-primary/20', text: 'text-primary' },
  submitted: { bg: 'bg-warning/15 border border-warning/20', text: 'text-warning' },
  approved: { bg: 'bg-success/15 border border-success/20', text: 'text-success' },
  returned: { bg: 'bg-destructive/15 border border-destructive/20', text: 'text-destructive' },
  archived: { bg: 'bg-muted border border-border', text: 'text-muted-foreground' },
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, { bg: string; text: string }> = {
  low: { bg: 'bg-muted border border-border', text: 'text-muted-foreground' },
  medium: { bg: 'bg-primary/15 border border-primary/20', text: 'text-primary' },
  high: { bg: 'bg-warning/15 border border-warning/20', text: 'text-warning' },
  urgent: { bg: 'bg-destructive/15 border border-destructive/20', text: 'text-destructive' },
};

