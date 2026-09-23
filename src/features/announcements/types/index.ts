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
  low: { label: 'Low', color: 'bg-muted text-muted-foreground' },
  normal: { label: 'Normal', color: 'bg-primary/10 text-primary' },
  high: { label: 'High', color: 'bg-warning/15 text-warning' },
  urgent: { label: 'Urgent', color: 'bg-destructive/15 text-destructive' },
};

export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
  published: { label: 'Published', color: 'bg-success/15 text-success' },
  archived: { label: 'Archived', color: 'bg-muted text-muted-foreground' },
};

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  coordinator: 'Coordinator',
  supervisor: 'Supervisor',
  trainee: 'Trainee',
};
