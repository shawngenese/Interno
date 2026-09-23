import { useState, useEffect, useCallback } from 'react';
import { listDocuments, updateDocumentStatus, deleteDocument } from '../services/documentService';
import { DocumentChecklist } from './DocumentChecklist';
import { useToast } from '@/shared/components/Toast';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { FileText, CheckCircle2, XCircle, Trash2, ExternalLink } from 'lucide-react';
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
    pending: 'bg-warning/10 text-warning border-warning/20',
    approved: 'bg-success/10 text-success border-success/20',
    rejected: 'bg-destructive/10 text-destructive border-destructive/20',
    archived: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border capitalize ${styles[status]}`}>
      {status}
    </span>
  );
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
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

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
    setActionLoadingId(doc.id);
    try {
      await updateDocumentStatus(doc.id, 'approved');
      addToast('success', 'Document approved');
      await fetchDocuments();
    } catch (err) {
      console.error('Approve failed:', err);
      addToast('error', 'Failed to approve document');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = (doc: Document) => {
    setConfirmDialog({
      title: 'Reject Document',
      message: 'Are you sure you want to reject this document?',
      danger: true,
      onConfirm: async () => {
        setActionLoadingId(doc.id);
        try {
          await updateDocumentStatus(doc.id, 'rejected');
          addToast('success', 'Document rejected');
          await fetchDocuments();
        } catch (err) {
          console.error('Reject failed:', err);
          addToast('error', 'Failed to reject document');
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  const handleDelete = (doc: Document) => {
    setConfirmDialog({
      title: 'Delete Document',
      message: 'Delete this document permanently? This action cannot be undone.',
      danger: true,
      onConfirm: async () => {
        setActionLoadingId(doc.id);
        try {
          await deleteDocument(doc.id);
          addToast('success', 'Document deleted');
          await fetchDocuments();
        } catch (err) {
          console.error('Delete failed:', err);
          addToast('error', 'Failed to delete document');
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / (filters.limit || 20)));

  return (
    <div className="space-y-6">
      {traineeId && role === 'trainee' && (
        <DocumentChecklist traineeId={traineeId} companyId={companyId} />
      )}

      {role !== 'trainee' && (
        <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isSupervisor ? 'Assigned Trainees\' Documents' : 'All Documents'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Review, approve, or reject trainee document submissions</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters(f => ({ ...f, status: e.target.value as DocumentStatus | undefined, page: 1 }))}
                aria-label="Filter by status"
                className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            <div role="alert" className="mb-4 p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center justify-between">
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={() => { setError(null); fetchDocuments(); }}>Retry</Button>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} variant="rectangular" height={52} className="rounded-lg" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <EmptyState
              title="No documents found"
              description="No document submissions match your current filters."
            />
          ) : (
            <>
              {/* Mobile Card Layout */}
              <div className="space-y-3 md:hidden">
                {documents.map((doc) => (
                  <div key={doc.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <div>
                          <p className="font-semibold text-foreground text-sm">{typeLabel(doc.type)}</p>
                          <p className="text-xs text-muted-foreground">{traineeNameMap.get(doc.traineeId) || doc.traineeId.slice(0, 8) + '...'}</p>
                        </div>
                      </div>
                      {statusBadge(doc.status)}
                    </div>

                    <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border flex items-center justify-between">
                      <span className="truncate max-w-[200px] text-foreground font-medium">{doc.fileName}</span>
                      <span>{formatSize(doc.fileSize)} • {formatDate(doc.createdAt)}</span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-8 px-3 text-xs font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> View
                      </a>
                      {canApproveReject && doc.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            isLoading={actionLoadingId === doc.id}
                            onClick={() => handleApprove(doc)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            isLoading={actionLoadingId === doc.id}
                            onClick={() => handleReject(doc)}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(doc)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trainee</th>
                      <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                      <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">File</th>
                      <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Size</th>
                      <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Uploaded</th>
                      <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                      <th className="h-[44px] px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="h-[44px] hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{traineeNameMap.get(doc.traineeId) || doc.traineeId.slice(0, 8) + '...'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{typeLabel(doc.type)}</td>
                        <td className="px-4 py-3 text-foreground font-medium truncate max-w-xs">{doc.fileName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatSize(doc.fileSize)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(doc.createdAt)}</td>
                        <td className="px-4 py-3">{statusBadge(doc.status)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-8 px-2.5 text-xs font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" /> View
                            </a>
                            {canApproveReject && doc.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  isLoading={actionLoadingId === doc.id}
                                  onClick={() => handleApprove(doc)}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  isLoading={actionLoadingId === doc.id}
                                  onClick={() => handleReject(doc)}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {canDelete && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(doc)}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <p>
                    Showing {((filters.page ?? 1) - 1) * (filters.limit || 20) + 1} to {Math.min((filters.page ?? 1) * (filters.limit || 20), total)} of {total} records
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}
                      disabled={(filters.page || 1) <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
                      disabled={(filters.page || 1) >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        danger={confirmDialog?.danger}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}