import { useState, useEffect, useCallback } from 'react';
import { listLeaveRequests, reviewLeaveRequest } from '../services/leaveService';
import { useSupervisor } from '@/shared/hooks/useSupervisor';
import { useAuth } from '@/features/auth/AuthProvider';
import { Skeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { Button } from '@/shared/components/ui/Button';
import { Modal } from '@/shared/components/Modal';
import { Calendar, CheckCircle2, XCircle } from 'lucide-react';
import type { LeaveRequest, LeaveStatus, LeaveType, ListLeaveParams } from '../types';

const STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<LeaveStatus, string> = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  approved: 'bg-success/10 text-success border-success/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  cancelled: 'bg-muted text-muted-foreground border-border',
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
  const { user, role } = useAuth();
  const { supervisor } = useSupervisor();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ListLeaveParams>({ page: 1, limit: 20 });
  const [total, setTotal] = useState(0);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionModal, setActionModal] = useState<{ leave: LeaveRequest; action: 'approved' | 'rejected' } | null>(null);

  const fetchLeaves = useCallback(async (signal?: AbortSignal) => {
    if (!supervisor) return;
    setLoading(true);
    try {
      const companyId = supervisor.companyId;
      if (!companyId) {
        if (!signal?.aborted) {
          setLeaves([]);
          setTotal(0);
        }
        return;
      }
      const result = await listLeaveRequests({ ...filters, companyId });
      if (!signal?.aborted) {
        setLeaves(result.data);
        setTotal(result.total);
      }
    } catch (err) {
      if (!signal?.aborted) console.error('Failed to load leave requests:', err);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filters, supervisor]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLeaves(controller.signal);
    return () => controller.abort();
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
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-foreground">Leave Requests</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Review and take action on trainee leave applications</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as LeaveStatus }))}
              aria-label="Filter by status"
              className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
              className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={90} className="rounded-xl" />
            ))}
          </div>
        ) : leaves.length === 0 ? (
          <EmptyState
            title="No leave requests found"
            description="There are currently no leave requests submitted for your review."
          />
        ) : (
          <div className="space-y-3">
            {leaves.map((leave) => (
              <div key={leave.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">
                        {TYPE_LABELS[leave.type]}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border capitalize ${STATUS_STYLES[leave.status]}`}>
                        {STATUS_LABELS[leave.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                      </span>
                      <span className="font-semibold text-foreground">({daysBetween(leave.startDate, leave.endDate)} {daysBetween(leave.startDate, leave.endDate) === 1 ? 'day' : 'days'})</span>
                    </div>
                    <p className="text-xs text-foreground bg-muted/30 p-2.5 rounded-lg border border-border">{leave.reason}</p>
                    {leave.approvalNotes && (
                      <p className="text-xs text-muted-foreground italic">
                        Note: {leave.approvalNotes}
                      </p>
                    )}
                  </div>
                  {leave.status === 'pending' && (role === 'supervisor' || role === 'admin') && (
                    <div className="flex items-center gap-2 self-end sm:self-start">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setActionModal({ leave, action: 'approved' })}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setActionModal({ leave, action: 'rejected' })}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border">
            <span>
              Page {filters.page || 1} of {Math.ceil(total / 20)}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, (f.page || 1) - 1) }))}
                disabled={(filters.page || 1) <= 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))}
                disabled={(filters.page || 1) >= Math.ceil(total / 20)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {actionModal && (
        <Modal
          open={actionModal !== null}
          title={`${actionModal.action === 'approved' ? 'Approve' : 'Reject'} Leave Request`}
          onClose={() => { setActionModal(null); setReviewNotes(''); }}
        >
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {TYPE_LABELS[actionModal.leave.type]} &middot; {formatDate(actionModal.leave.startDate)} – {formatDate(actionModal.leave.endDate)}
            </p>
            <div>
              <label htmlFor="review-notes" className="block text-xs font-semibold text-foreground mb-1.5">
                Approval / Rejection Notes (optional)
              </label>
              <textarea
                id="review-notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                aria-label="Review notes"
                className="w-full p-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                placeholder="Optional notes or feedback for the trainee..."
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                onClick={() => { setActionModal(null); setReviewNotes(''); }}
              >
                Cancel
              </Button>
              <Button
                variant={actionModal.action === 'approved' ? 'primary' : 'destructive'}
                isLoading={!!reviewing}
                onClick={handleReview}
              >
                {actionModal.action === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
