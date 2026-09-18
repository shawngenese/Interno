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
  low: { label: 'Low', color: 'bg-[#EFEFEF] text-[#3A3A3A] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-[#EFEFEF] text-[#3A3A3A] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]' },
  published: { label: 'Published', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  archived: { label: 'Archived', color: 'bg-[#D5D5D5] text-[#555555] dark:bg-[#555555] dark:text-[#9E9E9E]' },
};

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  coordinator: 'Coordinator',
  supervisor: 'Supervisor',
  trainee: 'Trainee',
};
