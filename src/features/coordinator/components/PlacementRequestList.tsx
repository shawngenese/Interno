import { useState, useEffect, useCallback } from 'react';
import { placementService } from '../services/placementService';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { PlacementRequest, PlacementStatus } from '@/features/admin/types';

interface PlacementRequestListProps {
  onRefresh?: () => void;
}

export function PlacementRequestList({ onRefresh }: PlacementRequestListProps) {
  const { user, role } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [requests, setRequests] = useState<PlacementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<PlacementStatus | ''>('');
  const [selectedRequest, setSelectedRequest] = useState<PlacementRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  // Resolve coordinator's companyId
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    async function resolveCompanyId() {
      try {
        const db = getFirestoreInstancePublic();
        const snap = await getDoc(doc(db, 'coordinators', user!.uid));
        if (!cancelled && snap.exists()) {
          setCompanyId(snap.data().companyId as string);
        }
      } catch (err) {
        console.error('Failed to resolve coordinator companyId:', err);
      }
    }
    resolveCompanyId();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const fetchRequests = useCallback(async (signal?: AbortSignal) => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await placementService.getPlacementRequests(
        companyId,
        filterStatus as PlacementStatus || undefined,
      );
      if (!signal?.aborted) setRequests(data);
    } catch (err) {
      if (!signal?.aborted) {
        setError('Failed to load placement requests');
        console.error(err);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [companyId, filterStatus]);

  useEffect(() => {
    const controller = new AbortController();
    fetchRequests(controller.signal);
    return () => controller.abort();
  }, [fetchRequests]);

  const handleApprove = async (request: PlacementRequest) => {
    if (!user) return;
    if (!confirm('Approve this placement request?')) return;
    setProcessing(true);
    try {
      await placementService.approvePlacementRequest(request.id, user.uid, reviewNotes);
      setSelectedRequest(null);
      setReviewNotes('');
      fetchRequests();
      onRefresh?.();
    } catch (err) {
      setError('Failed to approve request');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (request: PlacementRequest) => {
    if (!user) return;
    if (!confirm('Reject this placement request?')) return;
    setProcessing(true);
    try {
      await placementService.rejectPlacementRequest(request.id, user.uid, reviewNotes);
      setSelectedRequest(null);
      setReviewNotes('');
      fetchRequests();
      onRefresh?.();
    } catch (err) {
      setError('Failed to reject request');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: PlacementStatus) => {
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

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
      <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#121212] dark:text-white">
            Placement Requests
          </h3>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as PlacementStatus | '')}
            className="px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#F5F5F5] dark:bg-[#3A3A3A]/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Trainee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">External Company</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Date Requested</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D5D5D5] dark:divide-[#3A3A3A]">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#757575] dark:text-[#9E9E9E]">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading...
                  </div>
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#757575] dark:text-[#9E9E9E]">
                  No placement requests found
                </td>
              </tr>
            ) : (
              requests.map((request) => (
                <tr key={request.id} className="hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/50">
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-[#121212] dark:text-white">{request.traineeName}</div>
                    <div className="text-sm text-[#757575] dark:text-[#9E9E9E]">{request.traineeEmail}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {request.externalCompanyName}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {request.createdAt?.seconds
                      ? new Date(request.createdAt.seconds * 1000).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {request.status === 'pending' && (
                      <button
                        onClick={() => setSelectedRequest(request)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-xl max-w-md w-full">
            <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
              <h4 className="text-lg font-semibold text-[#121212] dark:text-white">
                Review Placement Request
              </h4>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Trainee</p>
                <p className="font-medium text-[#121212] dark:text-white">{selectedRequest.traineeName}</p>
              </div>
              <div>
                <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">External Company</p>
                <p className="font-medium text-[#121212] dark:text-white">{selectedRequest.externalCompanyName}</p>
              </div>
              {selectedRequest.requestNotes && (
                <div>
                  <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Request Notes</p>
                  <p className="text-[#121212] dark:text-white">{selectedRequest.requestNotes}</p>
                </div>
              )}
              <div>
                <label htmlFor="placement-review-notes" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
                  Review Notes (optional)
                </label>
                <textarea
                  id="placement-review-notes"
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
                  setSelectedRequest(null);
                  setReviewNotes('');
                }}
                className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Cancel
              </button>
              {(role === 'coordinator' || role === 'admin') && (
                <>
                  <button
                    onClick={() => handleReject(selectedRequest)}
                    disabled={processing}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(selectedRequest)}
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
