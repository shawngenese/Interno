import { useState, useEffect, useCallback } from 'react';
import { placementService } from '../services/placementService';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { PlacementRequest, PlacementStatus } from '@/features/admin/types';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { FormField, FormTextarea } from '@/shared/components/FormField';
import { Calendar, Building2, User } from 'lucide-react';

interface PlacementRequestListProps {
  onRefresh?: () => void;
}

export function PlacementRequestList({ onRefresh }: PlacementRequestListProps) {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [requests, setRequests] = useState<PlacementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<PlacementStatus | ''>('');
  const [selectedRequest, setSelectedRequest] = useState<PlacementRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  // Resolve coordinator's companyId
  const userId = user?.uid;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function resolveCompanyId(uid: string) {
      try {
        const db = getFirestoreInstancePublic();
        const snap = await getDoc(doc(db, 'coordinators', uid));
        if (!cancelled && snap.exists()) {
          setCompanyId(snap.data().companyId as string);
        }
      } catch (err) {
        console.error('Failed to resolve coordinator companyId:', err);
      }
    }
    resolveCompanyId(userId);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const fetchRequests = useCallback(async (signal?: AbortSignal) => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await placementService.getPlacementRequests(
        companyId,
        (filterStatus as PlacementStatus) || undefined,
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
    setConfirmDialog({
      title: 'Approve Placement Request',
      message: `Approve placement for ${request.traineeName} at ${request.externalCompanyName}?`,
      onConfirm: async () => {
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
      },
    });
  };

  const handleReject = async (request: PlacementRequest) => {
    if (!user) return;
    setConfirmDialog({
      title: 'Reject Placement Request',
      message: `Reject placement request for ${request.traineeName}?`,
      danger: true,
      onConfirm: async () => {
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
      },
    });
  };

  const getStatusBadge = (status: PlacementStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-warning/15 text-warning';
      case 'approved':
        return 'bg-success/15 text-success';
      case 'rejected':
        return 'bg-destructive/15 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Placement Requests
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage trainee applications for external company placements
          </p>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as PlacementStatus | '')}
          className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="p-5 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 border border-border rounded-xl space-y-2">
              <Skeleton variant="text" width="40%" height={18} />
              <Skeleton variant="text" width="60%" height={14} />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="p-8">
          <EmptyState
            title="No placement requests yet"
            description="No placement requests yet. Trainees will appear here when they apply."
          />
        </div>
      ) : (
        <>
          {/* Mobile Card Layout (md:hidden) */}
          <div className="divide-y divide-border md:hidden">
            {requests.map((request) => (
              <div key={request.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">{request.traineeName}</h4>
                    <p className="text-xs text-muted-foreground">{request.traineeEmail}</p>
                  </div>
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${getStatusBadge(
                      request.status,
                    )}`}
                  >
                    {request.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Company: <strong className="text-foreground font-medium">{request.externalCompanyName}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Requested:{' '}
                      {request.createdAt?.seconds
                        ? new Date(request.createdAt.seconds * 1000).toLocaleDateString()
                        : '-'}
                    </span>
                  </div>
                </div>

                {request.status === 'pending' && (
                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedRequest(request)}
                    >
                      Review Request
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table Layout (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Trainee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    External Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Date Requested
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-foreground">{request.traineeName}</div>
                      <div className="text-xs text-muted-foreground">{request.traineeEmail}</div>
                    </td>
                    <td className="px-4 py-3.5 text-foreground font-medium">
                      {request.externalCompanyName}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">
                      {request.createdAt?.seconds
                        ? new Date(request.createdAt.seconds * 1000).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${getStatusBadge(
                          request.status,
                        )}`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {request.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRequest(request)}
                        >
                          Review
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <Modal
          open={!!selectedRequest}
          size="md"
          title="Review Placement Request"
          onClose={() => {
            setSelectedRequest(null);
            setReviewNotes('');
          }}
        >
          <div className="space-y-4">
            <div className="p-4 bg-muted/40 rounded-xl space-y-2 border border-border">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-semibold text-foreground">{selectedRequest.traineeName}</span>
                <span className="text-xs text-muted-foreground">({selectedRequest.traineeEmail})</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="w-4 h-4 text-primary shrink-0" />
                <span>External Company: <strong className="text-foreground font-medium">{selectedRequest.externalCompanyName}</strong></span>
              </div>
              {selectedRequest.requestNotes && (
                <div className="pt-2 border-t border-border text-xs">
                  <p className="font-medium text-foreground mb-0.5">Trainee Notes:</p>
                  <p className="text-muted-foreground">{selectedRequest.requestNotes}</p>
                </div>
              )}
            </div>

            <FormField id="placement-review-notes" label="Coordinator Decision Notes (Optional)">
              <FormTextarea
                id="placement-review-notes"
                value={reviewNotes}
                onValueChange={setReviewNotes}
                rows={3}
                placeholder="Add any remarks or conditions for this placement approval/rejection..."
              />
            </FormField>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setSelectedRequest(null);
                  setReviewNotes('');
                }}
              >
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  type="button"
                  onClick={() => handleReject(selectedRequest)}
                  isLoading={processing}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => handleApprove(selectedRequest)}
                  isLoading={processing}
                >
                  Approve
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        danger={confirmDialog?.danger}
        onConfirm={() => {
          confirmDialog?.onConfirm();
          setConfirmDialog(null);
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
