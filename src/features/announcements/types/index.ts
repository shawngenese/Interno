export type AnnouncementPriority = 'low' | 'normal' | 'high' | 'urgent';

export type AnnouncementStatus = 'draft' | 'published' | 'archived';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  companyId: string;
  departmentId?: string;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  targetRoles: ('admin' | 'coordinator' | 'supervisor' | 'trainee')[];
  pinned: boolean;
  expiresAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface AnnouncementFormData {
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  companyId: string;
  departmentId?: string;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  targetRoles: ('admin' | 'coordinator' | 'supervisor' | 'trainee')[];
  pinned: boolean;
  expiresAt?: number;
}

export const ANNOUNCEMENT_PRIORITY_LABELS: Record<AnnouncementPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  published: { label: 'Published', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  archived: { label: 'Archived', color: 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-400' },
};

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  coordinator: 'Coordinator',
  supervisor: 'Supervisor',
  trainee: 'Trainee',
};
