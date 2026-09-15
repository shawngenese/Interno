import { useState, useCallback, useRef } from 'react';
import { uploadAndCreateDocument, uploadAndCreateTaskDocument, uploadProfileImage } from '../services/documentService';
import type { UploadParams, DocumentType, TaskDocumentType } from '../types';

interface DocumentUploaderProps {
  bucket: 'documents' | 'tasks' | 'profiles';
  resourceId: string; // traineeId, taskId, or userId
  documentType?: DocumentType | TaskDocumentType;
  metadata: Omit<UploadParams, 'fileName' | 'mimeType' | 'fileSize'>;
  onSuccess?: (fileName: string) => void;
  onError?: (error: string) => void;
  acceptedTypes?: string;
  maxSizeMB?: number;
}

export function DocumentUploader({
  bucket,
  resourceId,
  documentType,
  metadata,
  onSuccess,
  onError,
  acceptedTypes = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp',
  maxSizeMB = 10,
}: DocumentUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  const handleUpload = useCallback(async (file: File) => {
    // Client-side validation
    if (file.size > maxSizeMB * 1024 * 1024) {
      const msg = `File size exceeds ${maxSizeMB}MB limit`;
      setError(msg);
      onError?.(msg);
      return;
    }

    const allowed = acceptedTypes.split(',').map(t => t.trim().replace('.', ''));
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowed.includes(ext) && !allowed.includes('*')) {
      const msg = `File type .${ext} not allowed`;
      setError(msg);
      onError?.(msg);
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);
    cancelledRef.current = false;

    let progressInterval: ReturnType<typeof setInterval> | null = null;
    try {
      // Simulate progress (real progress would need Supabase JS SDK with onUploadProgress)
      progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 10, 90));
      }, 100);

      if (bucket === 'documents') {
        await uploadAndCreateDocument(
          file,
          { ...metadata, traineeId: resourceId, bucket: 'documents' },
          { type: documentType as DocumentType, status: 'pending', companyId: metadata.companyId || '', traineeId: resourceId },
        );
      } else if (bucket === 'tasks') {
        await uploadAndCreateTaskDocument(
          file,
          { ...metadata, taskId: resourceId, bucket: 'tasks' },
          { type: documentType as TaskDocumentType, companyId: metadata.companyId || '', traineeId: metadata.traineeId || '', taskId: resourceId },
        );
      } else {
        await uploadProfileImage(file, resourceId);
      }

      if (cancelledRef.current) return;

      setProgress(100);
      onSuccess?.(file.name);
    } catch (err) {
      if (cancelledRef.current) return;
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      onError?.(message);
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      if (!cancelledRef.current) {
        setUploading(false);
        setTimeout(() => setProgress(0), 500);
      }
    }
  }, [bucket, resourceId, documentType, metadata, maxSizeMB, acceptedTypes, onSuccess, onError]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Upload {bucket === 'documents' ? 'Document' : bucket === 'tasks' ? 'Task Attachment' : 'Profile Image'}
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          uploading ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'
        }`}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !uploading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload file"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          disabled={uploading}
        />

        {uploading ? (
          <div className="space-y-3">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Uploading... {progress}%</p>
          </div>
        ) : (
          <>
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Click or drag & drop to upload
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              Max {maxSizeMB}MB • {acceptedTypes.replace(/,/g, ', ')}
            </p>
          </>
        )}
      </div>

      {uploading && (
        <button
          onClick={() => { cancelledRef.current = true; setUploading(false); setProgress(0); }}
          className="mt-4 w-full px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
        >
          Cancel Upload
        </button>
      )}
    </div>
  );
}