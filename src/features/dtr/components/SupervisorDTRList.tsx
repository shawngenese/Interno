import { useState, useEffect, useCallback } from 'react';
import { listDTRs, listCorrectionRequests } from '../services/dtrService';
import { useToast } from '@/shared/components/Toast';
import { formatDateFull, formatTime12 } from '@/shared/utils/dateUtils';
import type { DTREntry, DTRStatus, DTRCorrectionRequest, ListDTRParams } from '../types';

function minutesToHours(mins: number): string {
  return (mins / 60).toFixed(2);
}

function statusBadge(status: DTREntry['status']): React.ReactNode {
  const styles: Record<DTREntry['status'], string> = {
    draft: 'bg-[#EFEFEF] text-[#3A3A3A] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    corrected: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };
  return <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[status]}`}>{status}</span>;
}

export function SupervisorDTRList() {
  const { addToast } = useToast();
  const [dtrs, setDtrs] = useState<DTREntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ListDTRParams>({ page: 1, limit: 20, status: 'pending' });
  const [total, setTotal] = useState(0);
  const [selectedDTR, setSelectedDTR] = useState<DTREntry | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [corrections, setCorrections] = useState<DTRCorrectionRequest[]>([]);

  const fetchDTRs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listDTRs(filters);
      setDtrs(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load DTRs:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDTRs();
  }, [fetchDTRs]);

  const handleView = async (dtr: DTREntry) => {
    setSelectedDTR(dtr);
    setShowDetail(true);
    setDetailLoading(true);
    try {
      const correctionData = await listCorrectionRequests(dtr.id);
      setCorrections(correctionData);
    } catch (err) {
      console.error('Failed to load DTR detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async (dtr: DTREntry) => {
    try {
      const { getFirestoreInstancePublic } = await import('@/config/firebase');
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { getAuthInstancePublic } = await import('@/config/firebase');
      const auth = getAuthInstancePublic();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');

      await updateDoc(doc(getFirestoreInstancePublic(), 'dtrs', dtr.id), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
      });
      await fetchDTRs();
      if (selectedDTR?.id === dtr.id) handleView(dtr);
    } catch (err) {
      console.error('Approve failed:', err);
      addToast('error', 'Failed to approve DTR');
    }
  };

  const handleReject = async (dtr: DTREntry) => {
    if (!confirm('Reject this DTR?')) return;
    try {
      const { getFirestoreInstancePublic } = await import('@/config/firebase');
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { getAuthInstancePublic } = await import('@/config/firebase');
      const auth = getAuthInstancePublic();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');

      await updateDoc(doc(getFirestoreInstancePublic(), 'dtrs', dtr.id), {
        status: 'rejected',
        reviewedAt: serverTimestamp(),
        reviewedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
      });
      await fetchDTRs();
      if (selectedDTR?.id === dtr.id) handleView(dtr);
    } catch (err) {
      console.error('Reject failed:', err);
      addToast('error', 'Failed to reject DTR');
    }
  };

  const handleCorrectionAction = async (correction: DTRCorrectionRequest, action: 'approve' | 'reject') => {
    try {
      const { getFirestoreInstancePublic } = await import('@/config/firebase');
      const { doc, updateDoc, getDoc, serverTimestamp } = await import('firebase/firestore');
      const { getAuthInstancePublic } = await import('@/config/firebase');
      const auth = getAuthInstancePublic();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');

      const db = getFirestoreInstancePublic();

      if (action === 'approve') {
        // Apply proposed values to DTR
        const dtrSnap = await getDoc(doc(db, 'dtrs', correction.dtrId));
        if (!dtrSnap.exists()) throw new Error('DTR not found');

        await updateDoc(doc(db, 'dtrs', correction.dtrId), {
          ...correction.proposedValue,
          status: 'corrected',
          correctionRequestId: correction.id,
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'dtrs', correction.dtrId, 'correction_requests', correction.id), {
          status: 'approved',
          reviewedBy: currentUser.uid,
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'dtrs', correction.dtrId, 'correction_requests', correction.id), {
          status: 'rejected',
          reviewedBy: currentUser.uid,
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      if (selectedDTR) handleView(selectedDTR);
    } catch (err) {
      console.error('Correction action failed:', err);
      addToast('error', 'Failed to process correction request');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / (filters.limit || 20)));

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-[#121212] dark:text-white">DTR Approval</h2>
          <div className="flex flex-wrap gap-3">
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters(f => ({ ...f, status: e.target.value as DTRStatus | undefined, page: 1 }))}
              aria-label="Filter by status"
              className="px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="corrected">Corrected</option>
            </select>
            <input
              type="date"
              value={filters.startDate ? new Date(filters.startDate).toISOString().split('T')[0] : ''}
              onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value ? new Date(e.target.value).getTime() : undefined, page: 1 }))}
              aria-label="Start date"
              className="px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
              placeholder="Start Date"
            />
            <input
              type="date"
              value={filters.endDate ? new Date(filters.endDate).toISOString().split('T')[0] : ''}
              onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value ? new Date(e.target.value).getTime() + 86400000 - 1 : undefined, page: 1 }))}
              aria-label="End date"
              className="px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
              placeholder="End Date"
            />
            <select
              value={filters.page || 1}
              onChange={(e) => setFilters(f => ({ ...f, page: Number(e.target.value) }))}
              className="px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white w-32"
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>Page {p}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F5F5] dark:bg-[#3A3A3A]/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Trainee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Regular (hrs)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">OT (hrs)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Late (min)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Undertime (min)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5D5D5] dark:divide-[#3A3A3A]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <svg className="animate-spin mx-auto h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </td>
                </tr>
              ) : dtrs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#757575] dark:text-[#9E9E9E]">No DTR entries found</td>
                </tr>
              ) : (
                dtrs.map((dtr) => (
                  <tr key={dtr.id} className="hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/50 cursor-pointer" onClick={() => handleView(dtr)}>
                    <td className="px-4 py-3 text-sm font-medium text-[#121212] dark:text-white">{dtr.traineeId.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-sm text-[#757575] dark:text-[#9E9E9E]">{formatDateFull(dtr.date)}</td>
                    <td className="px-4 py-3 text-sm text-[#121212] dark:text-white">{minutesToHours(dtr.regularMinutes)}</td>
                    <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400">{minutesToHours(dtr.overtimeMinutes)}</td>
                    <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{dtr.lateMinutes}</td>
                    <td className="px-4 py-3 text-sm text-orange-600 dark:text-orange-400">{dtr.undertimeMinutes}</td>
                    <td className="px-4 py-3 text-sm">{statusBadge(dtr.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {dtr.status === 'pending' && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleApprove(dtr); }}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReject(dtr); }}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleView(dtr); }}
                          className="px-3 py-1.5 text-xs font-medium text-[#555555] dark:text-[#9E9E9E] hover:text-[#121212] dark:hover:text-white"
                        >
                          View
                        </button>
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
            </div>
          )}
        </div>
      </div>

      {showDetail && selectedDTR && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dtr-detail-modal-title"
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowDetail(false); setSelectedDTR(null); } }}
        >
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div
            className="bg-white dark:bg-[#1E1E1E] rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onKeyDown={(e) => { if (e.key === 'Escape') { setShowDetail(false); setSelectedDTR(null); } }}
          >
            <div className="p-6 border-b border-[#D5D5D5] dark:border-[#3A3A3A] flex items-center justify-between">
              <h3 id="dtr-detail-modal-title" className="text-lg font-semibold text-[#121212] dark:text-white">
                DTR Detail: {selectedDTR.traineeId.slice(0, 8)}... - {formatDateFull(selectedDTR.date)}
              </h3>
              <button aria-label="Close" onClick={() => { setShowDetail(false); setSelectedDTR(null); }} className="text-[#9E9E9E] hover:text-[#555555]">✕</button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center h-64">
                <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-[#F5F5F5] dark:bg-[#1E1E1E]/50 rounded-lg">
                    <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Time In</p>
                    <p className="text-xl font-bold text-[#121212] dark:text-white">{selectedDTR.actualTimeIn ? formatTime12(selectedDTR.actualTimeIn) : '—'}</p>
                  </div>
                  <div className="p-4 bg-[#F5F5F5] dark:bg-[#1E1E1E]/50 rounded-lg">
                    <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Time Out</p>
                    <p className="text-xl font-bold text-[#121212] dark:text-white">{selectedDTR.actualTimeOut ? formatTime12(selectedDTR.actualTimeOut) : '—'}</p>
                  </div>
                  <div className="p-4 bg-[#F5F5F5] dark:bg-[#1E1E1E]/50 rounded-lg">
                    <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Regular (hrs)</p>
                    <p className="text-xl font-bold text-[#121212] dark:text-white">{minutesToHours(selectedDTR.regularMinutes)}</p>
                  </div>
                  <div className="p-4 bg-[#F5F5F5] dark:bg-[#1E1E1E]/50 rounded-lg">
                    <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">OT (hrs)</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{minutesToHours(selectedDTR.overtimeMinutes)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-[#F5F5F5] dark:bg-[#1E1E1E]/50 rounded-lg">
                    <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Late (min)</p>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">{selectedDTR.lateMinutes}</p>
                  </div>
                  <div className="p-4 bg-[#F5F5F5] dark:bg-[#1E1E1E]/50 rounded-lg">
                    <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Undertime (min)</p>
                    <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{selectedDTR.undertimeMinutes}</p>
                  </div>
                  <div className="p-4 bg-[#F5F5F5] dark:bg-[#1E1E1E]/50 rounded-lg">
                    <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Night Diff (min)</p>
                    <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{selectedDTR.nightDiffMinutes}</p>
                  </div>
                  <div className="p-4 bg-[#F5F5F5] dark:bg-[#1E1E1E]/50 rounded-lg">
                    <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Status</p>
                    <p className="text-xl font-bold">{statusBadge(selectedDTR.status)}</p>
                  </div>
                </div>

                {selectedDTR.status === 'pending' && (
                  <div className="flex justify-end gap-3 pt-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A]">
                    <button onClick={() => handleReject(selectedDTR)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
                      Reject
                    </button>
                    <button onClick={() => handleApprove(selectedDTR)} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                      Approve
                    </button>
                  </div>
                )}

                {corrections.length > 0 && (
                  <div className="pt-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A]">
                    <h4 className="text-md font-medium text-[#121212] dark:text-white mb-3">Correction Requests ({corrections.length})</h4>
                    <div className="space-y-3">
                      {corrections.map((c) => (
                        <div key={c.id} className="p-4 bg-[#F5F5F5] dark:bg-[#1E1E1E]/50 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-[#121212] dark:text-white">{c.status}</span>
                            <span className="text-xs text-[#757575]">by {c.requestedBy.slice(0, 8)}...</span>
                          </div>
                          <p className="text-sm text-[#555555] dark:text-[#9E9E9E] mb-2">Reason: {c.reason}</p>
                          <div className="text-xs text-[#757575] mb-2">
                            Proposed: {c.proposedValue.actualTimeIn ? formatTime12(c.proposedValue.actualTimeIn) : '—'} - {c.proposedValue.actualTimeOut ? formatTime12(c.proposedValue.actualTimeOut) : '—'}
                          </div>
                          {c.status === 'pending' && (
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => handleCorrectionAction(c, 'approve')} className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700">
                                Approve Correction
                              </button>
                              <button onClick={() => handleCorrectionAction(c, 'reject')} className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700">
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}