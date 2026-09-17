import { useState, useEffect } from 'react';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Document, DocumentType } from '../types';

interface DocumentChecklistProps {
  traineeId: string;
}

const REQUIRED_DOCUMENTS: { type: DocumentType; label: string; description: string }[] = [
  { type: 'resume', label: 'Resume/CV', description: 'Updated resume with contact information' },
  { type: 'endorsement', label: 'Endorsement Letter', description: 'School endorsement letter for OJT' },
  { type: 'agreement', label: 'Training Agreement', description: 'Signed agreement between school and company' },
  { type: 'medical', label: 'Medical Certificate', description: 'Recent medical certificate' },
  { type: 'consent', label: 'Consent Form', description: 'Parent/guardian consent form (if applicable)' },
];

export function DocumentChecklist({ traineeId }: DocumentChecklistProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, [traineeId]);

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

  const getDocumentStatus = (type: DocumentType): 'missing' | 'pending' | 'approved' | 'rejected' => {
    const docs = documents.filter(d => d.type === type);
    if (docs.length === 0) return 'missing';
    if (docs.some(d => d.status === 'approved')) return 'approved';
    if (docs.some(d => d.status === 'rejected')) return 'rejected';
    return 'pending';
  };

  const completedCount = REQUIRED_DOCUMENTS.filter(
    doc => getDocumentStatus(doc.type) === 'approved'
  ).length;

  const progress = Math.round((completedCount / REQUIRED_DOCUMENTS.length) * 100);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Document Requirements</h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {completedCount}/{REQUIRED_DOCUMENTS.length} completed
        </span>
      </div>

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-3">
        {REQUIRED_DOCUMENTS.map((req) => {
          const status = getDocumentStatus(req.type);
          return (
            <div
              key={req.type}
              className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
            >
              <div className="flex-shrink-0 mt-0.5">
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
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white text-sm">{req.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{req.description}</div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {status === 'missing' ? 'Not uploaded' : status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
