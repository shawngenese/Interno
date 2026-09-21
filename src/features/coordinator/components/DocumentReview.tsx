import { useState, useEffect, useCallback } from 'react';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuth } from '@/features/auth';
import type { Document } from '@/features/documents/types';

interface Trainee {
  id: string;
  name: string;
  email: string;
}

function toMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export function DocumentReview() {
  const { user, role } = useAuth();
  const [documents, setDocuments] = useState<(Document & { traineeName?: string })[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [filterTrainee, setFilterTrainee] = useState<string>('');
  const [selectedDoc, setSelectedDoc] = useState<(Document & { traineeName?: string }) | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const db = getFirestoreInstancePublic();

      // Get coordinator's companyId
      if (!user) return;
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (!userSnap.exists()) return;
      if (signal?.aborted) return;
      const userData = userSnap.data() as { companyId?: string };
      const companyId = userData.companyId || '';

      // Get trainees in this company
      const traineeSnap = await getDocs(
        query(collection(db, 'trainees'), where('companyId', '==', companyId))
      );
      if (signal?.aborted) return;
      const traineeMap = new Map<string, string>();
      const traineeList: Trainee[] = [];
      for (const t of traineeSnap.docs) {
        const data = t.data();
        let name = '';
        if (data.userId) {
          const userDoc = await getDoc(doc(db, 'users', data.userId));
          if (userDoc.exists()) {
            name = (userDoc.data().displayName as string) || (userDoc.data().email as string) || '';
          }
        }
        if (!name) name = data.name || t.id.slice(0, 8) + '...';
        traineeMap.set(t.id, name);
        traineeList.push({ id: t.id, name, email: data.email || '' });
      }
      setTrainees(traineeList);

      // Get documents for these trainees
      const traineeIds = traineeSnap.docs.map(d => d.id);
      if (traineeIds.length === 0) {
        setDocuments([]);
        return;
      }

      const allDocs: (Document & { traineeName?: string })[] = [];

      if (filterTrainee) {
        let q = query(collection(db, 'documents'), where('traineeId', '==', filterTrainee));
        if (filterStatus) {
          q = query(q, where('status', '==', filterStatus));
        }
        const docSnap = await getDocs(q);
        docSnap.docs.forEach(d => {
          const data = d.data() as Record<string, unknown>;
          allDocs.push({
            id: d.id,
            traineeId: data.traineeId as string,
            companyId: data.companyId as string,
            type: data.type as Document['type'],
            fileName: data.fileName as string,
            fileUrl: data.fileUrl as string,
            fileSize: data.fileSize as number,
            mimeType: data.mimeType as string,
            storagePath: data.storagePath as string,
            status: data.status as 'pending' | 'approved' | 'rejected',
            uploadedBy: data.uploadedBy as string,
            createdAt: toMillis(data.createdAt),
            updatedAt: toMillis(data.updatedAt),
            reviewedBy: data.reviewedBy as string,
            reviewedAt: toMillis(data.reviewedAt),
            reviewNotes: data.reviewNotes as string,
            traineeName: traineeMap.get(data.traineeId as string),
          });
        });
      } else {
        const chunks: string[][] = [];
        for (let i = 0; i < traineeIds.length; i += 30) {
          chunks.push(traineeIds.slice(i, i + 30));
        }
        for (const chunk of chunks) {
          let q = query(collection(db, 'documents'), where('traineeId', 'in', chunk));
          if (filterStatus) {
            q = query(q, where('status', '==', filterStatus));
          }
          const docSnap = await getDocs(q);
          docSnap.docs.forEach(d => {
            const data = d.data() as Record<string, unknown>;
            allDocs.push({
              id: d.id,
              traineeId: data.traineeId as string,
              companyId: data.companyId as string,
              type: data.type as Document['type'],
              fileName: data.fileName as string,
              fileUrl: data.fileUrl as string,
              fileSize: data.fileSize as number,
              mimeType: data.mimeType as string,
              storagePath: data.storagePath as string,
              status: data.status as 'pending' | 'approved' | 'rejected',
              uploadedBy: data.uploadedBy as string,
              createdAt: toMillis(data.createdAt),
              updatedAt: toMillis(data.updatedAt),
              reviewedBy: data.reviewedBy as string,
              reviewedAt: toMillis(data.reviewedAt),
              reviewNotes: data.reviewNotes as string,
              traineeName: traineeMap.get(data.traineeId as string),
            });
          });
        }
      }

      allDocs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      if (!signal?.aborted) setDocuments(allDocs);
    } catch (err) {
      if (!signal?.aborted) {
        console.error('Failed to load documents:', err);
        setError('Failed to load documents');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user, filterStatus, filterTrainee]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const handleApprove = async (docId: string) => {
    if (!user) return;
    setProcessing(true);
    try {
      const db = getFirestoreInstancePublic();
      const docRef = doc(db, 'documents', docId);
      await updateDoc(docRef, {
        status: 'approved',
        reviewedBy: user.uid,
        reviewedAt: serverTimestamp(),
        ...(reviewNotes ? { reviewNotes } : {}),
      });
      setSelectedDoc(null);
      setReviewNotes('');
      fetchData();
    } catch (err) {
      setError('Failed to approve document');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (docId: string) => {
    if (!user) return;
    setProcessing(true);
    try {
      const db = getFirestoreInstancePublic();
      const docRef = doc(db, 'documents', docId);

      // Delete the Storage file to avoid orphaned files
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const docData = docSnap.data();
          if (docData.storagePath) {
            const { getStorageInstancePublic } = await import('@/config/firebase');
            const storage = getStorageInstancePublic();
            const { ref, deleteObject } = await import('firebase/storage');
            await deleteObject(ref(storage, docData.storagePath));
          }
        }
      } catch (storageErr) {
        console.warn('Failed to delete rejected file from storage:', storageErr);
      }

      await updateDoc(docRef, {
        status: 'rejected',
        reviewedBy: user.uid,
        reviewedAt: serverTimestamp(),
        ...(reviewNotes ? { reviewNotes } : {}),
      });
      setSelectedDoc(null);
      setReviewNotes('');
      fetchData();
    } catch (err) {
      setError('Failed to reject document');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-[#EFEFEF] text-[#1E1E1E] dark:bg-[#3A3A3A] dark:text-[#9E9E9E]';
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#121212] dark:text-white">Document Review</h2>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
        <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
          <div className="flex items-center gap-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={filterTrainee}
              onChange={(e) => setFilterTrainee(e.target.value)}
              className="px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Trainees</option>
              {trainees.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F5F5] dark:bg-[#3A3A3A]/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Trainee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Document Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">File</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Uploaded</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5D5D5] dark:divide-[#3A3A3A]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#757575] dark:text-[#9E9E9E]">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading documents...
                    </div>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#757575] dark:text-[#9E9E9E]">
                    No documents found
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/50">
                    <td className="px-4 py-4">
                      <div className="font-medium text-[#121212] dark:text-white">{doc.traineeName || 'Unknown'}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                      {getDocumentTypeLabel(doc.type)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-[#121212] dark:text-white">{doc.fileName}</div>
                      <div className="text-xs text-[#757575] dark:text-[#9E9E9E]">
                        {(doc.fileSize / 1024).toFixed(1)} KB
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                      {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => setSelectedDoc(doc)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
              <h4 className="text-lg font-semibold text-[#121212] dark:text-white">
                Review Document
              </h4>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Trainee</p>
                <p className="font-medium text-[#121212] dark:text-white">{selectedDoc.traineeName}</p>
              </div>
              <div>
                <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Document Type</p>
                <p className="font-medium text-[#121212] dark:text-white">{getDocumentTypeLabel(selectedDoc.type)}</p>
              </div>
              <div>
                <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">File</p>
                <a
                  href={selectedDoc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {selectedDoc.fileName}
                </a>
              </div>
              <div>
                <label htmlFor="review-notes" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
                  Review Notes (optional)
                </label>
                <textarea
                  id="review-notes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add notes about your decision..."
                />
              </div>
            </div>
            <div className="p-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A] flex justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedDoc(null);
                  setReviewNotes('');
                }}
                className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Cancel
              </button>
              {(role === 'coordinator' || role === 'admin') && (
                <>
                  <button
                    onClick={() => handleReject(selectedDoc.id)}
                    disabled={processing}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(selectedDoc.id)}
                    disabled={processing}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Approve
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
