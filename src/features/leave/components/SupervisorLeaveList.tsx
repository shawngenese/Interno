import { useState, useEffect, useCallback } from 'react';
import { listLeaveRequests, reviewLeaveRequest } from '../services/leaveService';
import { useAuth } from '@/features/auth/AuthProvider';
import { SkeletonCard } from '@/shared/components/Skeleton';
import type { LeaveRequest, LeaveStatus, LeaveType, ListLeaveParams } from '../types';

const STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<LeaveStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-[#EFEFEF] text-[#555555] dark:bg-[#3A3A3A] dark:text-[#9E9E9E]',
};

const TYPE_LABELS: Record<LeaveType, string> = {
  sick: 'Sick',
  emergency: 'Emergency',
  personal: 'Personal',
  school_activity: 'School Activity',
  company_holiday: 'Company Holiday',
  other: 'Other',
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysBetween(start: number, end: number): number {
  return Math.ceil((end - start + 1) / (1000 * 60 * 60 * 24));
}

export function SupervisorLeaveList() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ListLeaveParams>({ page: 1, limit: 20 });
  const [total, setTotal] = useState(0);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionModal, setActionModal] = useState<{ leave: LeaveRequest; action: 'approved' | 'rejected' } | null>(null);

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listLeaveRequests(filters);
      setLeaves(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load leave requests:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const handleReview = async () => {
    if (!actionModal || !user?.uid) return;
    setReviewing(actionModal.leave.id);
    try {
      await reviewLeaveRequest(actionModal.leave.id, actionModal.action, user.uid, reviewNotes);
      setActionModal(null);
      setReviewNotes('');
      fetchLeaves();
    } catch (err) {
      console.error('Failed to review leave:', err);
    } finally {
      setReviewing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#121212] dark:text-white">Leave Requests</h2>
        <span className="text-sm text-[#757575] dark:text-[#9E9E9E]">{total} total</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.status || ''}
          onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as LeaveStatus }))}
          aria-label="Filter by status"
          className="rounded-lg border border-[#BDBDBD] dark:border-[#555555] bg-white dark:bg-[#1E1E1E] px-3 py-1.5 text-sm dark:text-white"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={filters.type || ''}
          onChange={(e) => setFilters((f) => ({ ...f, type: (e.target.value || undefined) as LeaveType }))}
          aria-label="Filter by leave type"
          className="rounded-lg border border-[#BDBDBD] dark:border-[#555555] bg-white dark:bg-[#1E1E1E] px-3 py-1.5 text-sm dark:text-white"
        >
          <option value="">All Types</option>
          <option value="sick">Sick</option>
          <option value="emergency">Emergency</option>
          <option value="personal">Personal</option>
          <option value="school_activity">School Activity</option>
          <option value="company_holiday">Company Holiday</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : leaves.length === 0 ? (
        <div className="text-center py-8 text-[#757575] dark:text-[#9E9E9E]">No leave requests found</div>
      ) : (
        <div className="space-y-3">
          {leaves.map((leave) => (
            <div key={leave.id} className="rounded-lg border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#121212] dark:text-white">
                      {TYPE_LABELS[leave.type]}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_STYLES[leave.status]}`}>
                      {STATUS_LABELS[leave.status]}
                    </span>
                  </div>
                  <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                    <span className="ml-2 text-[#9E9E9E]">({daysBetween(leave.startDate, leave.endDate)}d)</span>
                  </p>
                  <p className="text-sm text-[#555555] dark:text-[#BDBDBD]">{leave.reason}</p>
                  {leave.approvalNotes && (
                    <p className="text-xs text-[#757575] dark:text-[#9E9E9E] italic">
                      Note: {leave.approvalNotes}
                    </p>
                  )}
                </div>
                {leave.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActionModal({ leave, action: 'approved' })}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setActionModal({ leave, action: 'rejected' })}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, (f.page || 1) - 1) }))}
            disabled={(filters.page || 1) <= 1}
            className="rounded-lg border border-[#BDBDBD] dark:border-[#555555] px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-[#555555] dark:text-[#9E9E9E]">
            Page {filters.page || 1} of {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))}
            disabled={(filters.page || 1) >= Math.ceil(total / 20)}
            className="rounded-lg border border-[#BDBDBD] dark:border-[#555555] px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Review Modal */}
      {actionModal && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-review-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) { setActionModal(null); setReviewNotes(''); } }}
        >
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div
            className="w-full max-w-md rounded-lg bg-white dark:bg-[#1E1E1E] p-6 space-y-4"
            onKeyDown={(e) => { if (e.key === 'Escape') { setActionModal(null); setReviewNotes(''); } }}
          >
            <h3 id="leave-review-modal-title" className="text-lg font-semibold text-[#121212] dark:text-white">
              {actionModal.action === 'approved' ? 'Approve' : 'Reject'} Leave Request
            </h3>
            <p className="text-sm text-[#555555] dark:text-[#BDBDBD]">
              {TYPE_LABELS[actionModal.leave.type]} &middot; {formatDate(actionModal.leave.startDate)} - {formatDate(actionModal.leave.endDate)}
            </p>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
              aria-label="Review notes"
              className="w-full rounded-lg border border-[#BDBDBD] dark:border-[#555555] bg-white dark:bg-[#1E1E1E] px-3 py-2 text-sm dark:text-white"
              placeholder="Notes (optional)"
            />
            <div className="flex gap-3">
              <button
                onClick={handleReview}
                disabled={!!reviewing}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  actionModal.action === 'approved'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {reviewing ? 'Processing...' : actionModal.action === 'approved' ? 'Confirm Approve' : 'Confirm Reject'}
              </button>
              <button
                onClick={() => { setActionModal(null); setReviewNotes(''); }}
                aria-label="Close"
                className="flex-1 rounded-lg border border-[#BDBDBD] dark:border-[#555555] px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] hover:bg-[#F5F5F5] dark:hover:bg-[#1E1E1E]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
