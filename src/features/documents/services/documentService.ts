import { callEdgeFunction, isSupabaseConfigured, getSupabase } from '@/config/supabase';
import { getAuthInstancePublic } from '@/config/firebase';
import type { QueryConstraint } from 'firebase/firestore';
import type {
  Document,
  TaskDocument,
  ProfileImage,
  UploadValidationResult,
  UploadParams,
  ListDocumentsParams,
  PaginatedDocumentsResponse,
  ListTaskDocumentsParams,
  PaginatedTaskDocumentsResponse,
} from '../types';

const LIST_FETCH_CAP = 500;

async function getIdToken(): Promise<string> {
  const auth = getAuthInstancePublic();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');
  return currentUser.getIdToken(true);
}

/** Get signed upload URL from Edge validate_upload. */
export async function getUploadUrl(params: UploadParams): Promise<UploadValidationResult> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const idToken = await getIdToken();
  return callEdgeFunction<UploadValidationResult>('validate_upload', params as unknown as Record<string, unknown>, { idToken });
}

/** Upload file to Supabase Storage using Supabase JS SDK. */
export async function uploadToStorage(bucket: string, path: string, file: File): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

/** Get signed download URL for a storage path (valid for 1 hour). */
export async function getDownloadUrl(bucket: string, path: string): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }
  return data.signedUrl;
}

/** Create document metadata in Firestore after upload. */
export async function createDocument(
  data: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Document> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const ref = await addDoc(collection(db, 'documents'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { ...data, id: ref.id, createdAt: Date.now(), updatedAt: Date.now() };
}

/** Create task document metadata. */
export async function createTaskDocument(
  data: Omit<TaskDocument, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<TaskDocument> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const ref = await addDoc(collection(db, 'task_documents'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { ...data, id: ref.id, createdAt: Date.now(), updatedAt: Date.now() };
}

/** Get a document by ID. */
export async function getDocument(id: string): Promise<Document | null> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { doc, getDoc } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();
  const snap = await getDoc(doc(db, 'documents', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Document) : null;
}

/** List documents with filters and pagination. */
export async function listDocuments(params: ListDocumentsParams = {}): Promise<PaginatedDocumentsResponse> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const page = params.page ?? 1;
  const pageLimit = params.limit ?? 20;
  const constraints: QueryConstraint[] = [];
  if (params.traineeId) constraints.push(where('traineeId', '==', params.traineeId));
  if (params.type) constraints.push(where('type', '==', params.type));
  if (params.status) constraints.push(where('status', '==', params.status));
  if (params.companyId) constraints.push(where('companyId', '==', params.companyId));

  constraints.push(orderBy('createdAt', 'desc'), limit(LIST_FETCH_CAP));

  const snap = await getDocs(query(collection(db, 'documents'), ...constraints));
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Document));

  const start = (page - 1) * pageLimit;
  return {
    data: all.slice(start, start + pageLimit),
    total: all.length,
    page,
    limit: pageLimit,
    totalPages: Math.max(1, Math.ceil(all.length / pageLimit)),
  };
}

/** Update document status (approve/reject). */
export async function updateDocumentStatus(
  id: string,
  status: Document['status'],
  reviewNotes?: string,
): Promise<void> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
  const { getAuthInstancePublic } = await import('@/config/firebase');
  const auth = getAuthInstancePublic();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const db = getFirestoreInstancePublic();
  await updateDoc(doc(db, 'documents', id), {
    status,
    reviewedBy: currentUser.uid,
    reviewedAt: serverTimestamp(),
    ...(reviewNotes ? { reviewNotes } : {}),
    updatedAt: serverTimestamp(),
  });
}

/** Delete document metadata and file from storage. */
export async function deleteDocument(id: string): Promise<void> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { doc, getDoc, deleteDoc } = await import('firebase/firestore');
  const { getAuthInstancePublic } = await import('@/config/firebase');
  const auth = getAuthInstancePublic();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const db = getFirestoreInstancePublic();
  const docRef = doc(db, 'documents', id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Document not found');

  const data = snap.data() as Document;
  // Only owner or admin can delete
  if (data.uploadedBy !== currentUser.uid) {
    const callerRole = (await currentUser.getIdTokenResult()).claims.role as string | undefined;
    if (callerRole !== 'admin') throw new Error('Not authorized to delete this document');
  }

  // Delete from Supabase Storage
  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    const bucket = data.storagePath.split('/')[0];
    const path = data.storagePath.split('/').slice(1).join('/');
    await supabase.storage.from(bucket).remove([path]);
  }

  // Delete metadata
  await deleteDoc(docRef);
}

/** List task documents. */
export async function listTaskDocuments(params: ListTaskDocumentsParams = {}): Promise<PaginatedTaskDocumentsResponse> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const page = params.page ?? 1;
  const pageLimit = params.limit ?? 20;
  const constraints: QueryConstraint[] = [];
  if (params.taskId) constraints.push(where('taskId', '==', params.taskId));
  if (params.traineeId) constraints.push(where('traineeId', '==', params.traineeId));
  if (params.type) constraints.push(where('type', '==', params.type));

  constraints.push(orderBy('createdAt', 'desc'), limit(LIST_FETCH_CAP));

  const snap = await getDocs(query(collection(db, 'task_documents'), ...constraints));
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskDocument));

  const start = (page - 1) * pageLimit;
  return {
    data: all.slice(start, start + pageLimit),
    total: all.length,
    page,
    limit: pageLimit,
    totalPages: Math.max(1, Math.ceil(all.length / pageLimit)),
  };
}

/** Upload and create document in one flow (client-side helper). */
export async function uploadAndCreateDocument(
  file: File,
  metadata: Omit<UploadParams, 'fileName' | 'mimeType' | 'fileSize'>,
  documentData: Omit<Document, 'id' | 'fileName' | 'fileUrl' | 'fileSize' | 'mimeType' | 'storagePath' | 'createdAt' | 'updatedAt' | 'uploadedBy'>,
): Promise<Document> {
  // 1. Validate and get storage path
  const validation = await getUploadUrl({
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    ...metadata,
  } as UploadParams);

  // 2. Upload to Supabase Storage using SDK
  await uploadToStorage(metadata.bucket, validation.path, file);

  // 3. Create metadata in Firestore with uploadedBy from current user
  const { getAuthInstancePublic } = await import('@/config/firebase');
  const auth = getAuthInstancePublic();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const downloadUrl = await getDownloadUrl(metadata.bucket, validation.path);
  return createDocument({
    ...documentData,
    uploadedBy: currentUser.uid,
    fileName: file.name,
    fileUrl: downloadUrl,
    fileSize: file.size,
    mimeType: file.type,
    storagePath: validation.path,
  });
}

/** Upload and create task document. */
export async function uploadAndCreateTaskDocument(
  file: File,
  metadata: Omit<UploadParams, 'fileName' | 'mimeType' | 'fileSize'>,
  documentData: Omit<TaskDocument, 'id' | 'fileName' | 'fileUrl' | 'fileSize' | 'mimeType' | 'storagePath' | 'createdAt' | 'updatedAt' | 'uploadedBy'>,
): Promise<TaskDocument> {
  const validation = await getUploadUrl({
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    ...metadata,
  } as UploadParams);

  await uploadToStorage(metadata.bucket, validation.path, file);

  const { getAuthInstancePublic } = await import('@/config/firebase');
  const auth = getAuthInstancePublic();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const downloadUrl = await getDownloadUrl(metadata.bucket, validation.path);
  return createTaskDocument({
    ...documentData,
    uploadedBy: currentUser.uid,
    fileName: file.name,
    fileUrl: downloadUrl,
    fileSize: file.size,
    mimeType: file.type,
    storagePath: validation.path,
  });
}

/** Upload profile image. */
export async function uploadProfileImage(file: File, userId: string): Promise<ProfileImage> {
  const validation = await getUploadUrl({
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    bucket: 'profiles',
    userId,
  });

  await uploadToStorage('profiles', validation.path, file);

  const downloadUrl = await getDownloadUrl('profiles', validation.path);
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const ref = await addDoc(collection(db, 'profile_images'), {
    userId,
    fileName: file.name,
    fileUrl: downloadUrl,
    fileSize: file.size,
    mimeType: file.type,
    storagePath: validation.path,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: ref.id,
    userId,
    fileName: file.name,
    fileUrl: downloadUrl,
    fileSize: file.size,
    mimeType: file.type,
    storagePath: validation.path,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}