import { useState, useEffect, useCallback } from 'react';
import { getTraineeLeaveRequests, cancelLeaveRequest } from '../services/leaveService';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { SkeletonCard } from '@/shared/components/Skeleton';
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

export function TraineeLeaveView() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetchLeaves = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const db = getFirestoreInstancePublic();
      const traineeSnap = await getDocs(
        query(collection(db, 'trainees'), where('userId', '==', user.uid), where('status', '==', 'active')),
      );
      if (traineeSnap.empty) return;
      const traineeId = traineeSnap.docs[0].id;
      const data = await getTraineeLeaveRequests(traineeId);
      setLeaves(data);
    } catch (err) {
      console.error('Failed to load leave requests:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const handleCancel = async (leaveId: string) => {
    setCancelling(leaveId);
    try {
      await cancelLeaveRequest(leaveId);
      fetchLeaves();
    } catch (err) {
      console.error('Failed to cancel leave:', err);
    } finally {
      setCancelling(null);
    }
  };

  const pendingCount = leaves.filter((l) => l.status === 'pending').length;
  const approvedCount = leaves.filter((l) => l.status === 'approved').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#121212] dark:text-white">My Leave Requests</h2>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New Request
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="text-xs text-[#757575] dark:text-[#9E9E9E]">Pending</p>
        </div>
        <div className="rounded-lg border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
          <p className="text-xs text-[#757575] dark:text-[#9E9E9E]">Approved</p>
        </div>
        <div className="rounded-lg border border-[#D5D5D5] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E] p-3 text-center">
          <p className="text-2xl font-bold text-[#555555]">{leaves.length}</p>
          <p className="text-xs text-[#757575] dark:text-[#9E9E9E]">Total</p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : leaves.length === 0 ? (
        <div className="text-center py-8 text-[#757575] dark:text-[#9E9E9E]">No leave requests yet</div>
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
                      Supervisor note: {leave.approvalNotes}
                    </p>
                  )}
                </div>
                {leave.status === 'pending' && (
                  <button
                    onClick={() => handleCancel(leave.id)}
                    disabled={cancelling === leave.id}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    {cancelling === leave.id ? 'Cancelling...' : 'Cancel'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-form-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div
            className="w-full max-w-md rounded-lg bg-white dark:bg-[#1E1E1E] p-6"
            onKeyDown={(e) => { if (e.key === 'Escape') setShowForm(false); }}
          >
            <h3 id="leave-form-modal-title" className="text-lg font-semibold text-[#121212] dark:text-white mb-4">New Leave Request</h3>
            <LeaveForm
              onSaved={() => { setShowForm(false); fetchLeaves(); }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
