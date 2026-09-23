import { useState, useEffect, useCallback } from 'react';
import { getTraineeLeaveRequests, cancelLeaveRequest } from '../services/leaveService';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { Skeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Modal } from '@/shared/components/Modal';
import { Plus, Calendar } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { LeaveForm } from './LeaveForm';
import type { LeaveRequest, LeaveStatus, LeaveType } from '../types';

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

export function TraineeLeaveView() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const fetchLeaves = useCallback(async (signal?: AbortSignal) => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const db = getFirestoreInstancePublic();
      const traineeSnap = await getDocs(
        query(collection(db, 'trainees'), where('userId', '==', user.uid), where('status', '==', 'active')),
      );
      if (signal?.aborted) return;
      if (traineeSnap.empty) return;
      const traineeId = traineeSnap.docs[0].id;
      const data = await getTraineeLeaveRequests(traineeId);
      if (!signal?.aborted) setLeaves(data);
    } catch (err) {
      if (!signal?.aborted) console.error('Failed to load leave requests:', err);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLeaves(controller.signal);
    return () => controller.abort();
  }, [fetchLeaves]);

  const handleCancel = async (leaveId: string) => {
    setConfirmDialog({
      title: 'Cancel Leave Request',
      message: 'Are you sure you want to cancel this leave request?',
      danger: true,
      onConfirm: async () => {
        setCancelling(leaveId);
        try {
          await cancelLeaveRequest(leaveId);
          fetchLeaves();
        } catch (err) {
          console.error('Failed to cancel leave:', err);
        } finally {
          setCancelling(null);
        }
      },
    });
  };

  const pendingCount = leaves.filter((l) => l.status === 'pending').length;
  const approvedCount = leaves.filter((l) => l.status === 'approved').length;

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-foreground">My Leave Requests</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Apply for time off and check your request statuses</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            variant="primary"
            size="md"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Request
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
            <p className="text-2xl font-bold text-warning">{pendingCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
            <p className="text-2xl font-bold text-success">{approvedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Approved</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{leaves.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Requests</p>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={80} className="rounded-xl" />
            ))}
          </div>
        ) : leaves.length === 0 ? (
          <EmptyState
            title="No leave requests yet"
            description="You have not submitted any leave or absence requests."
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
                        Supervisor note: {leave.approvalNotes}
                      </p>
                    )}
                  </div>
                  {leave.status === 'pending' && (
                    <div className="self-end sm:self-start">
                      <Button
                        size="sm"
                        variant="destructive"
                        isLoading={cancelling === leave.id}
                        onClick={() => handleCancel(leave.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <Modal
          open={showForm}
          title="New Leave Request"
          onClose={() => setShowForm(false)}
        >
          <div>
            <LeaveForm
              onSaved={() => { setShowForm(false); fetchLeaves(); }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </Modal>
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
