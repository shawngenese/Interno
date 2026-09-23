import { useState, useEffect, useRef, useCallback } from 'react';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { uploadAndCreateDocument } from '../services/documentService';
import { useToast } from '@/shared/components/Toast';
import { Skeleton } from '@/shared/components/Skeleton';
import { CheckCircle2, Clock, XCircle, FileText, Upload } from 'lucide-react';
import type { Document, DocumentType } from '../types';

interface DocumentChecklistProps {
  traineeId: string;
  companyId?: string;
}

const REQUIRED_DOCUMENTS: { type: DocumentType; label: string; description: string }[] = [
  { type: 'resume', label: 'Resume/CV', description: 'Updated resume with contact information' },
  { type: 'endorsement', label: 'Endorsement Letter', description: 'School endorsement letter for OJT' },
  { type: 'agreement', label: 'Training Agreement', description: 'Signed agreement between school and company' },
  { type: 'medical', label: 'Medical Certificate', description: 'Recent medical certificate' },
  { type: 'consent', label: 'Consent Form', description: 'Parent/guardian consent form (if applicable)' },
];

export function DocumentChecklist({ traineeId, companyId: propCompanyId }: DocumentChecklistProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
  const [companyId, setCompanyId] = useState(propCompanyId || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTypeRef = useRef<DocumentType | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (propCompanyId || !traineeId) return;
    const resolveCompanyId = async () => {
      try {
        const db = getFirestoreInstancePublic();
        const { doc, getDoc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db, 'trainees', traineeId));
        if (snap.exists()) {
          const data = snap.data();
          if (data.companyId) setCompanyId(data.companyId);
        }
      } catch (err) {
        console.error('Failed to resolve companyId:', err);
      }
    };
    resolveCompanyId();
  }, [traineeId, propCompanyId]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const db = getFirestoreInstancePublic();
      const q = query(
        collection(db, 'documents'),
        where('traineeId', '==', traineeId)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Document));
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traineeId]);

  const getDocumentStatus = (type: DocumentType): 'missing' | 'pending' | 'approved' | 'rejected' => {
    const docs = documents.filter(d => d.type === type);
    if (docs.length === 0) return 'missing';
    if (docs.some(d => d.status === 'approved')) return 'approved';
    if (docs.some(d => d.status === 'pending')) return 'pending';
    if (docs.some(d => d.status === 'rejected')) return 'rejected';
    return 'missing';
  };

  const completedCount = REQUIRED_DOCUMENTS.filter(
    doc => getDocumentStatus(doc.type) === 'approved'
  ).length;

  const progress = Math.round((completedCount / REQUIRED_DOCUMENTS.length) * 100);

  const handleRowClick = useCallback((type: DocumentType, status: string) => {
    if (status === 'approved' || status === 'pending') return;
    pendingTypeRef.current = type;
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const type = pendingTypeRef.current;
    if (!file || !type) {
      setUploadingType(null);
      pendingTypeRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingType(type);
    try {
      await uploadAndCreateDocument(
        file,
        { traineeId, companyId: companyId || '', bucket: 'documents', documentType: type },
        { type, status: 'pending', companyId: companyId || '', traineeId },
      );
      addToast('success', 'Document uploaded successfully');
      setLoading(true);
      try {
        const db = getFirestoreInstancePublic();
        const q = query(collection(db, 'documents'), where('traineeId', '==', traineeId));
        const snap = await getDocs(q);
        setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Document)));
      } catch (err) {
        console.error('Failed to reload documents:', err);
      } finally {
        setLoading(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      addToast('error', message);
    } finally {
      setUploadingType(null);
      pendingTypeRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [traineeId, companyId, addToast]);

  const handleCancelUpload = useCallback(() => {
    setUploadingType(null);
    pendingTypeRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleFileInputBlur = useCallback(() => {
    if (pendingTypeRef.current && fileInputRef.current?.files?.length === 0) {
      setUploadingType(null);
      pendingTypeRef.current = null;
    }
  }, []);

  if (loading) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6 space-y-3">
        <Skeleton variant="text" width="40%" height={24} />
        <Skeleton variant="rectangular" height={8} className="rounded-full" />
        <div className="space-y-2 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="rectangular" height={56} className="rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFileChange}
        onBlur={handleFileInputBlur}
      />

      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-foreground text-base">Document Checklist</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Mandatory onboarding and OJT requirements</p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
          {completedCount} of {REQUIRED_DOCUMENTS.length} approved
        </span>
      </div>

      <div className="w-full bg-muted rounded-full h-2 mb-5 overflow-hidden">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-2.5">
        {REQUIRED_DOCUMENTS.map((req) => {
          const status = getDocumentStatus(req.type);
          const isClickable = status === 'missing' || status === 'rejected';
          const isUploading = uploadingType === req.type;

          return (
            <div key={req.type}>
              <div
                onClick={() => !isUploading && handleRowClick(req.type, status)}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isUploading) handleRowClick(req.type, status); }}
                role="button"
                tabIndex={isClickable ? 0 : -1}
                className={`min-h-[48px] flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isClickable && !isUploading
                    ? 'bg-card border-border hover:border-primary/50 hover:bg-muted/40 cursor-pointer'
                    : 'bg-muted/30 border-border'
                }`}
              >
                <div className="flex-shrink-0">
                  {status === 'approved' ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : status === 'pending' ? (
                    <Clock className="w-5 h-5 text-warning" />
                  ) : status === 'rejected' ? (
                    <XCircle className="w-5 h-5 text-destructive" />
                  ) : (
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground text-sm">{req.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{req.description}</div>
                </div>

                {isUploading ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-primary font-medium">Uploading...</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancelUpload(); }}
                      className="text-xs font-medium text-destructive hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : isClickable ? (
                  <span className="text-xs font-semibold text-primary flex-shrink-0 flex items-center gap-1 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    Upload
                  </span>
                ) : (
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize flex-shrink-0 ${
                    status === 'approved' ? 'bg-success/10 text-success border-success/20' :
                    status === 'pending' ? 'bg-warning/10 text-warning border-warning/20' :
                    'bg-muted text-muted-foreground border-border'
                  }`}>
                    {status}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
