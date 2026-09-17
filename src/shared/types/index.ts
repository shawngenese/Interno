export type UserRole = 'admin' | 'supervisor' | 'coordinator' | 'trainee';

export type AccountStatus = 'pending' | 'active' | 'inactive' | 'archived';

export type OJTStatus = 'pending' | 'active' | 'on_leave' | 'completed' | 'terminated' | 'archived';

export type OnlineStatus = 'online' | 'offline' | 'away';

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'on_leave';

export type PlacementType = 'internal' | 'external';

export type PlacementStatus = 'pending' | 'approved' | 'active' | 'completed' | 'rejected';

export interface Timestamp {
  seconds: number;
  nanoseconds: number;
}

export interface BaseEntity {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AuditLogEntry {
  timestamp: Timestamp;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  originalValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
