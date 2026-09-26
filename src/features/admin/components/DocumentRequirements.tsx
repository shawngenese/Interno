import { useState, useEffect, useCallback } from 'react';
import { listDocuments } from '@/features/documents/services/documentService';
import type { Document, DocumentType } from '@/features/documents/types';

const REQUIRED_DOCUMENTS: { type: DocumentType; label: string }[] = [
  { type: 'endorsement', label: 'Endorsement Letter' },
  { type: 'agreement', label: 'Agreement' },
  { type: 'medical', label: 'Medical Certificate' },
  { type: 'consent', label: 'Consent Form' },
  { type: 'resume', label: 'Resume/CV' },
  { type: 'school_reqs', label: 'School Requirements' },
  { type: 'completion', label: 'Completion Certificate' },
];

interface DocumentRequirementsProps {
  traineeId: string;
  companyId: string;
}

export function DocumentRequirements({ traineeId, companyId }: DocumentRequirementsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listDocuments({
        traineeId,
        companyId,
        limit: 100,
      });
      setDocuments(result.data);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [traineeId, companyId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const getDocumentForType = (type: DocumentType): Document | undefined => {
    return documents.find(doc => doc.type === type && doc.status !== 'archived');
  };

  const getStatusColor = (status: Document['status']) => {
    switch (status) {
      case 'approved': return 'bg-success/15 text-success';
      case 'pending': return 'bg-warning/15 text-warning';
      case 'rejected': return 'bg-destructive/15 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const completedCount = REQUIRED_DOCUMENTS.filter(doc => {
    const uploaded = getDocumentForType(doc.type);
    return uploaded && uploaded.status === 'approved';
  }).length;

  const uploadedCount = REQUIRED_DOCUMENTS.filter(doc => {
    return getDocumentForType(doc.type);
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Document Requirements</h3>
        <div className="text-xs text-muted-foreground">
          {uploadedCount}/{REQUIRED_DOCUMENTS.length} uploaded ({completedCount} approved)
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-xs">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {REQUIRED_DOCUMENTS.map(required => {
          const doc = getDocumentForType(required.type);
          return (
            <div
              key={required.type}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  doc?.status === 'approved'
                    ? 'bg-success'
                    : doc?.status === 'pending'
                    ? 'bg-warning'
                    : doc?.status === 'rejected'
                    ? 'bg-destructive'
                    : 'bg-muted'
                }`} />
                <span className="text-sm text-foreground/80">{required.label}</span>
              </div>
              {doc ? (
                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(doc.status)}`}>
                  {doc.status}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Not uploaded</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(uploadedCount / REQUIRED_DOCUMENTS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {Math.round((uploadedCount / REQUIRED_DOCUMENTS.length) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
