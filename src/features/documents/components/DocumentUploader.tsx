import { useState, useCallback, useRef } from 'react';
import { uploadAndCreateDocument, uploadAndCreateTaskDocument, uploadProfileImage } from '../services/documentService';
import { Button } from '@/shared/components/ui/Button';
import { UploadCloud, AlertCircle } from 'lucide-react';
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
      // Simulate progress (Firebase Storage doesn't expose streaming progress on web)
      progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 10, 90));
      }, 100);

      if (bucket === 'documents') {
        await uploadAndCreateDocument(
          file,
          { ...metadata, traineeId: resourceId, bucket: 'documents', documentType },
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
    <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
      <h3 className="text-base font-bold text-foreground mb-4">
        Upload {bucket === 'documents' ? 'Document' : bucket === 'tasks' ? 'Task Attachment' : 'Profile Image'}
      </h3>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-xl p-6 md:p-8 text-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          uploading ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60 bg-muted/20 hover:bg-muted/40'
        }`}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !uploading && fileInputRef.current?.click()}
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
          <div className="space-y-3 max-w-xs mx-auto">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Uploading... {progress}%</p>
          </div>
        ) : (
          <>
            <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground">
              Click or drag & drop to upload
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Max {maxSizeMB}MB • {acceptedTypes.replace(/,/g, ', ')}
            </p>
          </>
        )}
      </div>

      {uploading && (
        <div className="mt-4">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => { cancelledRef.current = true; setUploading(false); setProgress(0); }}
          >
            Cancel Upload
          </Button>
        </div>
      )}
    </div>
  );
}