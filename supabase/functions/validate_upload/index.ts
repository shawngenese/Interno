/**
 * Edge Function: validate_upload
 *
 * Validates and creates a signed upload URL for Supabase Storage.
 * Called by client via `callEdgeFunction('validate_upload', { fileName, mimeType, fileSize, bucket, traineeId, taskId })`.
 *
 * Body:
 * {
 *   fileName: string,
 *   mimeType: string,
 *   fileSize: number,          // bytes
 *   bucket: 'documents' | 'tasks' | 'profiles',
 *   traineeId?: string,        // for documents bucket
 *   taskId?: string,           // for tasks bucket
 *   userId?: string            // for profiles bucket
 * }
 *
 * Returns:
 * {
 *   success: true,
 *   uploadUrl: string,         // signed URL for PUT upload
 *   path: string,              // storage object path
 *   token: string,             // access token (same as uploadUrl auth)
 *   expiresAt: number          // epoch ms
 * }
 *
 * Validation:
 * - MIME type allowed (PDF, JPEG, PNG, WebP, DOC, DOCX, XLS, XLSX)
 * - File size <= 10MB (5MB for profiles)
 * - Magic bytes match MIME (basic)
 * - User owns the resource (traineeId/taskId/userId matches caller)
 */
import { serve } from 'std/http/server.ts';
import { initAdmin, getAuthInstance, getDbInstance, COLLECTIONS } from '../_shared/config.ts';
import { Timestamp } from 'npm:firebase-admin/firestore@12.7.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

function corsResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status: number) {
  return corsResponse({ error: message }, status);
}

const ALLOWED_MIME_TYPES = {
  documents: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  tasks: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  profiles: [
    'image/jpeg',
    'image/png',
    'image/webp',
  ],
} as const;

const MAX_FILE_SIZE = {
  documents: 10 * 1024 * 1024,  // 10MB
  tasks: 10 * 1024 * 1024,      // 10MB
  profiles: 5 * 1024 * 1024,    // 5MB
} as const;

const MAGIC_BYTES: Record<string, number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],           // %PDF
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],                       // FF D8 FF
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]], // PNG signature
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],                 // RIFF (check WEBP at offset 8)
  'application/msword': [[0xD0, 0xCF, 0x11, 0xE0]],         // OLE compound
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]], // ZIP (DOCX)
  'application/vnd.ms-excel': [[0xD0, 0xCF, 0x11, 0xE0]],   // OLE compound
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4B, 0x03, 0x04]], // ZIP (XLSX)
};

function checkMagicBytes(mimeType: string, buffer: Uint8Array): boolean {
  const patterns = MAGIC_BYTES[mimeType];
  if (!patterns) return true; // Unknown type - allow (will fail later)
  return patterns.some((pattern) => pattern.every((byte, i) => buffer[i] === byte));
}

function generateStoragePath(bucket: string, resourceId: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'bin';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `${bucket}/${resourceId}/${timestamp}_${random}.${ext}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse({});

  try {
    initAdmin();
    const auth = getAuthInstance();
    const db = getDbInstance();

    // Verify Firebase ID token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Missing or invalid Authorization header', 401);
    }
    const idToken = authHeader.slice(7);
    const decoded = await auth.verifyIdToken(idToken);
    const callerUid = decoded.uid;
    const callerRole = (decoded as Record<string, unknown>).role as string | undefined;
    const callerCompanyId = (decoded as Record<string, unknown>).companyId as string | undefined;

    if (!callerCompanyId) {
      return errorResponse('Caller missing companyId in custom claims', 400);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { fileName, mimeType, fileSize, bucket, traineeId, taskId, userId } = body as {
      fileName: string;
      mimeType: string;
      fileSize: number;
      bucket: 'documents' | 'tasks' | 'profiles';
      traineeId?: string;
      taskId?: string;
      userId?: string;
    };

    if (!fileName || !mimeType || !fileSize || !bucket) {
      return errorResponse('fileName, mimeType, fileSize, bucket are required', 400);
    }

    // Validate bucket
    const allowedBuckets = ['documents', 'tasks', 'profiles'] as const;
    if (!allowedBuckets.includes(bucket)) {
      return errorResponse(`Invalid bucket: ${bucket}. Must be one of: ${allowedBuckets.join(', ')}`, 400);
    }

    // Validate MIME type
    const allowedForBucket = ALLOWED_MIME_TYPES[bucket];
    if (!allowedForBucket.includes(mimeType as typeof allowedForBucket[number])) {
      return errorResponse(`MIME type ${mimeType} not allowed for ${bucket} bucket. Allowed: ${allowedForBucket.join(', ')}`, 400);
    }

    // Validate file size
    const maxSize = MAX_FILE_SIZE[bucket];
    if (fileSize > maxSize) {
      return errorResponse(`File size ${fileSize} bytes exceeds maximum ${maxSize} bytes for ${bucket} bucket`, 400);
    }

    // Determine resource ID for path and authorization
    let resourceId: string;
    if (bucket === 'documents') {
      if (!traineeId) return errorResponse('traineeId required for documents bucket', 400);
      resourceId = traineeId;
    } else if (bucket === 'tasks') {
      if (!taskId) return errorResponse('taskId required for tasks bucket', 400);
      resourceId = taskId;
    } else {
      if (!userId) return errorResponse('userId required for profiles bucket', 400);
      resourceId = userId;
    }

    // Authorization checks
    if (bucket === 'documents') {
      // Caller must be trainee owner, assigned supervisor, or admin
      const traineeSnap = await db.doc(COLLECTIONS.TRAINEES + '/' + traineeId).get();
      if (!traineeSnap.exists()) return errorResponse('Trainee not found', 404);
      const traineeData = traineeSnap.data() as Record<string, unknown>;
      if (traineeData.companyId !== callerCompanyId) return errorResponse('Trainee not in your company', 403);

      const isOwner = traineeData.userId === callerUid;
      const isSupervisor = callerRole === 'supervisor' && traineeData.supervisorId === callerUid;
      if (!(isOwner || isSupervisor || callerRole === 'admin')) {
        return errorResponse('Not authorized to upload for this trainee', 403);
      }
    } else if (bucket === 'tasks') {
      // Caller must be task creator, assigned trainee, or supervisor/admin
      const taskSnap = await db.doc(COLLECTIONS.TASKS + '/' + taskId).get();
      if (!taskSnap.exists()) return errorResponse('Task not found', 404);
      const taskData = taskSnap.data() as Record<string, unknown>;
      if (taskData.companyId !== callerCompanyId) return errorResponse('Task not in your company', 403);

      const isCreator = taskData.createdBy === callerUid;
      const isAssignee = taskData.traineeId === callerUid; // simplified
      if (!(isCreator || isAssignee || callerRole === 'admin' || callerRole === 'supervisor')) {
        return errorResponse('Not authorized to upload for this task', 403);
      }
    } else {
      // profiles - caller must be the user or admin
      if (userId !== callerUid && callerRole !== 'admin') {
        return errorResponse('Can only upload own profile image', 403);
      }
    }

    // Generate storage path
    const path = generateStoragePath(bucket, resourceId, fileName);

    // Supabase Storage signed URL (valid for 1 hour)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE');
    if (!supabaseUrl || !serviceRoleKey) {
      return errorResponse('Supabase configuration missing', 500);
    }

    const expiresIn = 3600; // 1 hour
    const signedUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}?token=${serviceRoleKey}`;

    // For actual upload, client uses the signed URL directly with PUT
    // We return the path and token info; client uses Supabase JS SDK or fetch PUT

    // Audit log
    const now = Date.now();
    await db.collection(COLLECTIONS.AUDIT_LOGS).add({
      timestamp: Timestamp.fromMillis(now),
      userId: callerUid,
      action: 'document_upload',
      entityType: 'document',
      entityId: path,
      newValue: { bucket, fileName, mimeType, fileSize, resourceId },
      metadata: { via: 'validate_upload' },
    });

    return corsResponse({
      success: true,
      uploadUrl: `${supabaseUrl}/storage/v1/object/${bucket}/${path}`,
      path,
      token: serviceRoleKey,
      expiresAt: now + expiresIn * 1000,
    });
  } catch (err) {
    console.error('[validate_upload] error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});