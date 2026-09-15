export type DocumentType = 'endorsement' | 'agreement' | 'medical' | 'consent' | 'resume' | 'school_reqs' | 'completion' | 'other';

export type DocumentStatus = 'pending' | 'approved' | 'rejected' | 'archived';

export type TaskDocumentType = 'screenshot' | 'report' | 'output' | 'photo' | 'accomplishment' | 'other';

export interface Document {
  id: string;
  traineeId: string;
  companyId: string;
  type: DocumentType;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  status: DocumentStatus;
  uploadedBy: string;
  reviewedBy?: string;
  reviewedAt?: number;
  reviewNotes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TaskDocument {
  id: string;
  taskId: string;
  traineeId: string;
  companyId: string;
  type: TaskDocumentType;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  uploadedBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProfileImage {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  createdAt: number;
  updatedAt: number;
}

export interface UploadValidationResult {
  success: boolean;
  path: string;
  bucket: string;
  expiresAt: number;
}

export interface UploadParams {
  fileName: string;
  mimeType: string;
  fileSize: number;
  bucket: 'documents' | 'tasks' | 'profiles';
  traineeId?: string;
  taskId?: string;
  userId?: string;
  companyId?: string;
}

export interface ListDocumentsParams {
  page?: number;
  limit?: number;
  traineeId?: string;
  type?: DocumentType;
  status?: DocumentStatus;
  companyId?: string;
}

export interface PaginatedDocumentsResponse {
  data: Document[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListTaskDocumentsParams {
  page?: number;
  limit?: number;
  taskId?: string;
  traineeId?: string;
  type?: TaskDocumentType;
}

export interface PaginatedTaskDocumentsResponse {
  data: TaskDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}