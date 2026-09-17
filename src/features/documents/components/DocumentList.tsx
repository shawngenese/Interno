import { useState, useEffect, useCallback } from 'react';
import { listDocuments, updateDocumentStatus, deleteDocument } from '../services/documentService';
import { DocumentUploader } from './DocumentUploader';
import { DocumentChecklist } from './DocumentChecklist';
import { useToast } from '@/shared/components/Toast';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
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
    archived: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
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
  const [filters, setFilters] = useState<ListDocumentsParams>({ page: 1, limit: 20, status: 'pending' });
  const [total, setTotal] = useState(0);
  const [showUploader, setShowUploader] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params: ListDocumentsParams = { ...filters };
      if (traineeId) params.traineeId = traineeId;
      if (companyId) params.companyId = companyId;

      const result = await listDocuments(params);
      setDocuments(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, traineeId, companyId]);

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

  const handleUploadSuccess = async () => {
    setShowUploader(false);
    await fetchDocuments();
  };

  const totalPages = Math.max(1, Math.ceil(total / (filters.limit || 20)));

  return (
    <div className="space-y-6">
      {traineeId && role === 'trainee' && (
        <DocumentChecklist traineeId={traineeId} />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {traineeId ? 'Trainee Documents' : isSupervisor ? 'Assigned Trainees\' Documents' : 'All Documents'}
          </h2>
          <div className="flex flex-wrap gap-3">
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters(f => ({ ...f, status: e.target.value as DocumentStatus | undefined, page: 1 }))}
              aria-label="Filter by status"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
            <button
              onClick={() => setShowUploader(!showUploader)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Upload Document
            </button>
          </div>
        </div>

        {showUploader && (
          <DocumentUploader
            bucket="documents"
            resourceId={filters.traineeId || ''}
            metadata={{ traineeId: filters.traineeId || '', companyId: filters.companyId || '', bucket: 'documents' }}
            onSuccess={handleUploadSuccess}
            onError={(err) => addToast('error', err)}
          />
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Trainee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">File</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Size</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Uploaded</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
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
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No documents found</td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{doc.traineeId.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{typeLabel(doc.type)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white truncate max-w-xs">{doc.fileName}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatSize(doc.fileSize)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(doc.createdAt)}</td>
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
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
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
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {((filters.page ?? 1) - 1) * (filters.limit || 20) + 1} to {Math.min((filters.page ?? 1) * (filters.limit || 20), total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}
                  disabled={(filters.page || 1) <= 1}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
                  disabled={(filters.page || 1) >= totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}