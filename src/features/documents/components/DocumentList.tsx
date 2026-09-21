import { useState, useEffect, useCallback } from 'react';
import { listDocuments, updateDocumentStatus, deleteDocument } from '../services/documentService';
import { DocumentChecklist } from './DocumentChecklist';
import { useToast } from '@/shared/components/Toast';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import type { Document, DocumentType, DocumentStatus, ListDocumentsParams } from '../types';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: DocumentStatus): React.ReactNode {
  const styles: Record<DocumentStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    archived: 'bg-[#EFEFEF] text-[#3A3A3A] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]',
  };
  return <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[status]}`}>{status}</span>;
}

function typeLabel(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    endorsement: 'Endorsement Letter',
    agreement: 'Agreement',
    medical: 'Medical Certificate',
    consent: 'Consent Form',
    resume: 'Resume/CV',
    school_reqs: 'School Requirements',
    completion: 'Completion Certificate',
    other: 'Other',
  };
  return labels[type] || type;
}

interface DocumentListProps {
  traineeId?: string;
  isSupervisor?: boolean;
  companyId?: string;
}

export function DocumentList({ traineeId: propTraineeId, isSupervisor = false, companyId }: DocumentListProps) {
  const { addToast } = useToast();
  const { user, role } = useAuth();
  const [resolvedTraineeId, setResolvedTraineeId] = useState<string | undefined>(undefined);

  // Resolve trainee doc ID from auth UID for trainee role
  useEffect(() => {
    if (role !== 'trainee' || !user?.uid) {
      setResolvedTraineeId(undefined);
      return;
    }
    const resolveId = async () => {
      try {
        const db = getFirestoreInstancePublic();
        const q = query(collection(db, 'trainees'), where('userId', '==', user.uid), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setResolvedTraineeId(snap.docs[0].id);
        }
      } catch (err) {
        console.error('Failed to resolve trainee ID:', err);
      }
    };
    resolveId();
  }, [role, user?.uid]);

  const traineeId = propTraineeId || resolvedTraineeId;
  const canApproveReject = role === 'supervisor' || role === 'admin' || role === 'coordinator';
  const canDelete = role === 'admin';
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ListDocumentsParams>({ page: 1, limit: 20 });
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [traineeNameMap, setTraineeNameMap] = useState<Map<string, string>>(new Map());

  const fetchDocuments = useCallback(async () => {
    if (role === 'trainee' && !traineeId) return;
    setLoading(true);
    setError(null);
    try {
      const params: ListDocumentsParams = { ...filters };
      if (traineeId) params.traineeId = traineeId;
      if (companyId) params.companyId = companyId;

      const result = await listDocuments(params);
      setDocuments(result.data);
      setTotal(result.total);

      const uniqueTraineeIds = [...new Set(result.data.map(d => d.traineeId).filter(Boolean))];
      const nameEntries = await Promise.all(
        uniqueTraineeIds.map(async (id) => {
          const { getFirestoreInstancePublic } = await import('@/config/firebase');
          const { doc, getDoc } = await import('firebase/firestore');
          const db = getFirestoreInstancePublic();
          const traineeSnap = await getDoc(doc(db, 'trainees', id));
          if (!traineeSnap.exists()) return { id, name: id.slice(0, 8) + '...' };
          const userId = traineeSnap.data()?.userId;
          if (!userId) return { id, name: id.slice(0, 8) + '...' };
          const name = await resolveDocName('users', userId, 'displayName');
          if (name) return { id, name };
          const email = await resolveDocName('users', userId, 'email');
          return { id, name: email || id.slice(0, 8) + '...' };
        }),
      );
      setTraineeNameMap(new Map(nameEntries.map(e => [e.id, e.name])));
    } catch (err) {
      console.error('Failed to load documents:', err);
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('permissions') || message.includes('insufficient')) {
        setError('Permission denied. Ensure you are assigned as a trainee and Firebase emulators are running.');
      } else {
        setError('Failed to load documents. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [filters, traineeId, companyId, role]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleApprove = async (doc: Document) => {
    try {
      await updateDocumentStatus(doc.id, 'approved');
      await fetchDocuments();
    } catch (err) {
      console.error('Approve failed:', err);
      addToast('error', 'Failed to approve document');
    }
  };

  const handleReject = async (doc: Document) => {
    if (!confirm('Reject this document?')) return;
    try {
      await updateDocumentStatus(doc.id, 'rejected');
      await fetchDocuments();
    } catch (err) {
      console.error('Reject failed:', err);
      addToast('error', 'Failed to reject document');
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm('Delete this document permanently?')) return;
    try {
      await deleteDocument(doc.id);
      await fetchDocuments();
    } catch (err) {
      console.error('Delete failed:', err);
      addToast('error', 'Failed to delete document');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / (filters.limit || 20)));

  return (
    <div className="space-y-6">
      {traineeId && role === 'trainee' && (
        <DocumentChecklist traineeId={traineeId} companyId={companyId} />
      )}

      {role !== 'trainee' && (
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-[#121212] dark:text-white">
            {isSupervisor ? 'Assigned Trainees\' Documents' : 'All Documents'}
          </h2>
          <div className="flex flex-wrap gap-3">
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters(f => ({ ...f, status: e.target.value as DocumentStatus | undefined, page: 1 }))}
              aria-label="Filter by status"
              className="px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={filters.type || ''}
              onChange={(e) => setFilters(f => ({ ...f, type: e.target.value as DocumentType | undefined, page: 1 }))}
              aria-label="Filter by document type"
              className="px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
            >
              <option value="">All Types</option>
              <option value="endorsement">Endorsement</option>
              <option value="agreement">Agreement</option>
              <option value="medical">Medical</option>
              <option value="consent">Consent</option>
              <option value="resume">Resume</option>
              <option value="school_reqs">School Reqs</option>
              <option value="completion">Completion</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => { setError(null); fetchDocuments(); }} className="text-sm font-medium text-red-700 dark:text-red-400 hover:underline">Retry</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F5F5] dark:bg-[#3A3A3A]/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Trainee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">File</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Size</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Uploaded</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5D5D5] dark:divide-[#3A3A3A]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <svg className="animate-spin mx-auto h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#757575] dark:text-[#9E9E9E]">No documents found</td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/50">
                    <td className="px-4 py-3 text-sm font-medium text-[#121212] dark:text-white">{traineeNameMap.get(doc.traineeId) || doc.traineeId.slice(0, 8) + '...'}</td>
                    <td className="px-4 py-3 text-sm text-[#757575] dark:text-[#9E9E9E]">{typeLabel(doc.type)}</td>
                    <td className="px-4 py-3 text-sm text-[#121212] dark:text-white truncate max-w-xs">{doc.fileName}</td>
                    <td className="px-4 py-3 text-sm text-[#757575] dark:text-[#9E9E9E]">{formatSize(doc.fileSize)}</td>
                    <td className="px-4 py-3 text-sm text-[#757575] dark:text-[#9E9E9E]">{formatDate(doc.createdAt)}</td>
                    <td className="px-4 py-3 text-sm">{statusBadge(doc.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                          View
                        </a>
                        {canApproveReject && doc.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(doc)}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(doc)}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(doc)}
                            className="px-3 py-1.5 text-xs font-medium text-[#555555] dark:text-[#9E9E9E] hover:text-red-600 dark:hover:text-red-400"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">
                Showing {((filters.page ?? 1) - 1) * (filters.limit || 20) + 1} to {Math.min((filters.page ?? 1) * (filters.limit || 20), total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}
                  disabled={(filters.page || 1) <= 1}
                  className="px-3 py-1 text-sm text-[#121212] dark:text-white border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A] disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
                  disabled={(filters.page || 1) >= totalPages}
                  className="px-3 py-1 text-sm text-[#121212] dark:text-white border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}