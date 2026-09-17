export const COMPANY_TYPES = {
  INTERNAL: 'internal',
  EXTERNAL: 'external',
} as const;

export const PLACEMENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ACTIVE: 'active',
  COMPLETED: 'completed',
} as const;

export const COLLECTIONS = {
  USERS: 'users',
  COMPANIES: 'companies',
  DEPARTMENTS: 'departments',
  SUPERVISORS: 'supervisors',
  TRAINEES: 'trainees',
  DTRS: 'dtrs',
  TASKS: 'tasks',
  DOCUMENTS: 'documents',
  ATTENDANCE_RECORDS: 'attendance_records',
  QR_SESSIONS: 'qr_sessions',
  LEAVE_REQUESTS: 'leave_requests',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
  NOTIFICATIONS: 'notifications',
  FCM_TOKENS: 'fcm_tokens',
  NOTIFICATION_PREFERENCES: 'notification_preferences',
  TASK_COMMENTS: 'task_comments',
  TASK_DOCUMENTS: 'task_documents',
  PROFILE_IMAGES: 'profile_images',
  WORK_SCHEDULES: 'work_schedules',
  OJT_SCHEDULES: 'ojt_schedules',
  PLACEMENT_REQUESTS: 'placement_requests',
  SUPERVISOR_INVITATIONS: 'supervisor_invitations',
} as const;
