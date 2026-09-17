import * as crypto from 'crypto';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { getAdminDb, COLLECTIONS, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_MB } from '../config';
import { logAction } from '../audit/auditLog';
import { Timestamp } from 'firebase-admin/firestore';

const ALLOWED_MIME_TYPES_MAP: Record<string, readonly string[]> = {
  documents: ALLOWED_MIME_TYPES,
  tasks: ALLOWED_MIME_TYPES,
  profiles: ['image/jpeg', 'image/png', 'image/webp'],
};

const MAX_FILE_SIZE_MAP: Record<string, number> = {
  documents: MAX_FILE_SIZE_MB * 1024 * 1024,
  tasks: MAX_FILE_SIZE_MB * 1024 * 1024,
  profiles: 5 * 1024 * 1024,
};

const MAGIC_BYTES: Record<string, number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'application/msword': [[0xD0, 0xCF, 0x11, 0xE0]],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]],
  'application/vnd.ms-excel': [[0xD0, 0xCF, 0x11, 0xE0]],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4B, 0x03, 0x04]],
};

function checkMagicBytes(mimeType: string, buffer: Uint8Array): boolean {
  const patterns = MAGIC_BYTES[mimeType];
  if (!patterns) return true;
  return patterns.some((pattern) => pattern.every((byte, i) => buffer[i] === byte));
}

function generateStoragePath(bucket: string, resourceId: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'bin';
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${bucket}/${resourceId}/${timestamp}_${random}.${ext}`;
}

export interface ValidateUploadRequest {
  fileName: string;
  mimeType: string;
  fileSize: number;
  bucket: 'documents' | 'tasks' | 'profiles';
  traineeId?: string;
  taskId?: string;
  userId?: string;
}

export interface ValidateUploadResponse {
  success: boolean;
  path: string;
  bucket: string;
  expiresAt: number;
}

export async function validateUploadHandler(
  request: CallableRequest<ValidateUploadRequest>
): Promise<ValidateUploadResponse> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const callerUid = request.auth.uid;
  const callerRole = request.auth.token?.role as string | undefined;
  const callerCompanyId = request.auth.token?.companyId as string | undefined;

  if (!callerCompanyId) {
    throw new HttpsError('invalid-argument', 'Caller missing companyId in custom claims');
  }

  const { fileName, mimeType, fileSize, bucket, traineeId, taskId, userId } = request.data;

  if (!fileName || !mimeType || !fileSize || !bucket) {
    throw new HttpsError('invalid-argument', 'fileName, mimeType, fileSize, bucket are required');
  }

  const allowedBuckets = ['documents', 'tasks', 'profiles'] as const;
  if (!allowedBuckets.includes(bucket as typeof allowedBuckets[number])) {
    throw new HttpsError('invalid-argument', `Invalid bucket: ${bucket}. Must be one of: ${allowedBuckets.join(', ')}`);
  }

  const allowedForBucket = ALLOWED_MIME_TYPES_MAP[bucket];
  if (!allowedForBucket.includes(mimeType)) {
    throw new HttpsError('invalid-argument', `MIME type ${mimeType} not allowed for ${bucket} bucket`);
  }

  const maxSize = MAX_FILE_SIZE_MAP[bucket];
  if (fileSize > maxSize) {
    throw new HttpsError('invalid-argument', `File size ${fileSize} bytes exceeds maximum ${maxSize} bytes for ${bucket} bucket`);
  }

  let resourceId: string;
  if (bucket === 'documents') {
    if (!traineeId) throw new HttpsError('invalid-argument', 'traineeId required for documents bucket');
    resourceId = traineeId;
  } else if (bucket === 'tasks') {
    if (!taskId) throw new HttpsError('invalid-argument', 'taskId required for tasks bucket');
    resourceId = taskId;
  } else {
    if (!userId) throw new HttpsError('invalid-argument', 'userId required for profiles bucket');
    resourceId = userId;
  }

  const db = getAdminDb();

  if (bucket === 'documents') {
    const traineeSnap = await db.doc(`${COLLECTIONS.TRAINEES}/${traineeId}`).get();
    if (!traineeSnap.exists) throw new HttpsError('not-found', 'Trainee not found');
    const traineeData = traineeSnap.data()!;
    if (traineeData.companyId !== callerCompanyId) throw new HttpsError('permission-denied', 'Trainee not in your company');

    const isOwner = traineeData.userId === callerUid;
    const isSupervisor = callerRole === 'supervisor' && traineeData.supervisorId === callerUid;
    if (!(isOwner || isSupervisor || callerRole === 'admin')) {
      throw new HttpsError('permission-denied', 'Not authorized to upload for this trainee');
    }
  } else if (bucket === 'tasks') {
    const taskSnap = await db.doc(`${COLLECTIONS.TASKS}/${taskId}`).get();
    if (!taskSnap.exists) throw new HttpsError('not-found', 'Task not found');
    const taskData = taskSnap.data()!;
    if (taskData.companyId !== callerCompanyId) throw new HttpsError('permission-denied', 'Task not in your company');

    const isCreator = taskData.createdBy === callerUid;
    const isAssignee = taskData.traineeId === callerUid;
    if (!(isCreator || isAssignee || callerRole === 'admin' || callerRole === 'supervisor')) {
      throw new HttpsError('permission-denied', 'Not authorized to upload for this task');
    }
  } else {
    if (userId !== callerUid && callerRole !== 'admin') {
      throw new HttpsError('permission-denied', 'Can only upload own profile image');
    }
  }

  const path = generateStoragePath(bucket, resourceId, fileName);

  const now = Date.now();
  await logAction({
    userId: callerUid,
    action: 'document_upload',
    entityType: 'document',
    entityId: path,
    newValue: { bucket, fileName, mimeType, fileSize, resourceId },
    metadata: { via: 'validateUpload' },
  });

  return {
    success: true,
    path,
    bucket,
    expiresAt: now + 3600 * 1000,
  };
}
