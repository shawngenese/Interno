import { useState, useEffect, useRef, useCallback } from 'react';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { uploadAndCreateDocument } from '../services/documentService';
import { useToast } from '@/shared/components/Toast';
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
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-4">
        <div className="flex items-center justify-center py-4">
          <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleFileChange}
          onBlur={handleFileInputBlur}
        />

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[#121212] dark:text-white">Document Requirements</h3>
        <span className="text-sm text-[#757575] dark:text-[#9E9E9E]">
          {completedCount}/{REQUIRED_DOCUMENTS.length} completed
        </span>
      </div>

      <div className="w-full bg-[#D5D5D5] dark:bg-[#3A3A3A] rounded-full h-2 mb-4">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-3">
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
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isClickable && !isUploading
                    ? 'bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer'
                    : 'bg-[#F5F5F5] dark:bg-[#3A3A3A]/50'
                }`}
              >
                <div className="flex-shrink-0">
                  {status === 'approved' ? (
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : status === 'pending' ? (
                    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 11.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l3-3A1 1 0 0011 10.586V7z" clipRule="evenodd" />
                    </svg>
                  ) : status === 'rejected' ? (
                    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-[#9E9E9E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#121212] dark:text-white text-sm">{req.label}</div>
                  <div className="text-xs text-[#757575] dark:text-[#9E9E9E]">{req.description}</div>
                </div>

                {isUploading ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-xs text-blue-600 dark:text-blue-400">Uploading...</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancelUpload(); }}
                      className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : isClickable ? (
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex-shrink-0 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload
                  </span>
                ) : (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${
                    status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                    status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-[#EFEFEF] text-[#555555] dark:bg-[#3A3A3A] dark:text-[#9E9E9E]'
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
