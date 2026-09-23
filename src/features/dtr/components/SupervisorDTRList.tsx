import { useState, useEffect, useCallback } from 'react';
import { listDTRs, listCorrectionRequests, approveDTR, rejectDTR, reviewCorrectionRequest } from '../services/dtrService';
import { useSupervisor } from '@/shared/hooks/useSupervisor';
import { useAuth } from '@/features/auth';
import { useToast } from '@/shared/components/Toast';
import { formatDateFull, formatTime12 } from '@/shared/utils/dateUtils';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { FileCheck, Clock, AlertTriangle, Moon, CheckCircle2, XCircle, Eye } from 'lucide-react';
import type { DTREntry, DTRStatus, DTRCorrectionRequest, ListDTRParams } from '../types';

function minutesToHours(mins: number): string {
  return (mins / 60).toFixed(2);
}

function statusBadge(status: DTREntry['status']): React.ReactNode {
  const styles: Record<DTREntry['status'], string> = {
    draft: 'bg-muted text-muted-foreground border-border',
    pending: 'bg-warning/10 text-warning border-warning/20',
    approved: 'bg-success/10 text-success border-success/20',
    rejected: 'bg-destructive/10 text-destructive border-destructive/20',
    corrected: 'bg-primary/10 text-primary border-primary/20',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}

export function SupervisorDTRList() {
  const { addToast } = useToast();
  const { role } = useAuth();
  const { supervisor } = useSupervisor();
  const [dtrs, setDtrs] = useState<DTREntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ListDTRParams>({ page: 1, limit: 20, status: 'pending' });
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedDTR, setSelectedDTR] = useState<DTREntry | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [corrections, setCorrections] = useState<DTRCorrectionRequest[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const fetchDTRs = useCallback(async () => {
    if (!supervisor) return;
    setLoading(true);
    try {
      const companyId = supervisor.companyId;
      if (!companyId) {
        setDtrs([]);
        setTotal(0);
        return;
      }
      const result = await listDTRs({ ...filters, companyId });
      setDtrs(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load DTRs:', err);
      setError('Failed to load DTRs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, supervisor]);

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
    setConfirmDialog({
      title: 'Approve DTR',
      message: `Approve DTR entry for ${formatDateFull(dtr.date)}?`,
      onConfirm: async () => {
        setActionLoadingId(dtr.id);
        try {
          await approveDTR(dtr.id);
          addToast('success', 'DTR approved');
          await fetchDTRs();
          if (selectedDTR?.id === dtr.id) {
            setSelectedDTR({ ...dtr, status: 'approved' });
          }
        } catch (err) {
          console.error('Approve failed:', err);
          addToast('error', 'Failed to approve DTR');
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  const handleReject = async (dtr: DTREntry) => {
    setConfirmDialog({
      title: 'Reject DTR',
      message: `Reject DTR entry for ${formatDateFull(dtr.date)}?`,
      danger: true,
      onConfirm: async () => {
        setActionLoadingId(dtr.id);
        try {
          await rejectDTR(dtr.id);
          addToast('success', 'DTR rejected');
          await fetchDTRs();
          if (selectedDTR?.id === dtr.id) {
            setSelectedDTR({ ...dtr, status: 'rejected' });
          }
        } catch (err) {
          console.error('Reject failed:', err);
          addToast('error', 'Failed to reject DTR');
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  const handleCorrectionAction = async (correction: DTRCorrectionRequest, action: 'approve' | 'reject') => {
    try {
      await reviewCorrectionRequest(correction.dtrId, correction.id, action);
      addToast('success', action === 'approve' ? 'Correction approved' : 'Correction rejected');
      if (selectedDTR) handleView(selectedDTR);
    } catch (err) {
      console.error('Correction action failed:', err);
      addToast('error', 'Failed to process correction request');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / (filters.limit || 20)));

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-foreground">DTR Approval</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Review and approve daily time records submitted by trainees</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters(f => ({ ...f, status: e.target.value as DTRStatus | undefined, page: 1 }))}
              aria-label="Filter by status"
              className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
              className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Start Date"
            />
            <input
              type="date"
              value={filters.endDate ? new Date(filters.endDate).toISOString().split('T')[0] : ''}
              onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value ? new Date(e.target.value).getTime() + 86400000 - 1 : undefined, page: 1 }))}
              aria-label="End date"
              className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="End Date"
            />
            {totalPages > 1 && (
              <select
                value={filters.page || 1}
                onChange={(e) => setFilters(f => ({ ...f, page: Number(e.target.value) }))}
                aria-label="Page navigation"
                className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm w-28 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>Page {p}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => { setError(null); fetchDTRs(); }}>Retry</Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="rectangular" height={52} className="rounded-lg" />
            ))}
          </div>
        ) : dtrs.length === 0 ? (
          <EmptyState
            title="No DTR records found"
            description="Adjust your filters or wait for trainees to submit attendance logs."
          />
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="space-y-3 md:hidden">
              {dtrs.map((dtr) => (
                <div
                  key={dtr.id}
                  onClick={() => handleView(dtr)}
                  className="bg-card border border-border rounded-xl p-4 space-y-3 hover:border-primary transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground text-sm">Trainee #{dtr.traineeId.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{formatDateFull(dtr.date)}</p>
                    </div>
                    {statusBadge(dtr.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border">
                    <div>
                      <span className="text-muted-foreground">Regular:</span>{' '}
                      <span className="font-semibold text-foreground">{minutesToHours(dtr.regularMinutes)} hrs</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">OT:</span>{' '}
                      <span className="font-semibold text-primary">{minutesToHours(dtr.overtimeMinutes)} hrs</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Late:</span>{' '}
                      <span className="font-semibold text-warning">{Math.round(dtr.lateMinutes)} min</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Undertime:</span>{' '}
                      <span className="font-semibold text-warning">{Math.round(dtr.undertimeMinutes)} min</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                    {dtr.status === 'pending' && (role === 'supervisor' || role === 'admin') && (
                      <>
                        <Button
                          size="sm"
                          variant="destructive"
                          isLoading={actionLoadingId === dtr.id}
                          onClick={(e) => { e.stopPropagation(); handleReject(dtr); }}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          isLoading={actionLoadingId === dtr.id}
                          onClick={(e) => { e.stopPropagation(); handleApprove(dtr); }}
                        >
                          Approve
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); handleView(dtr); }}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> View
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trainee</th>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Regular (hrs)</th>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">OT (hrs)</th>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Late (min)</th>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Undertime (min)</th>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="h-[44px] px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dtrs.map((dtr) => (
                    <tr
                      key={dtr.id}
                      className="h-[44px] hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleView(dtr)}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{dtr.traineeId.slice(0, 8)}...</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateFull(dtr.date)}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{minutesToHours(dtr.regularMinutes)}</td>
                      <td className="px-4 py-3 font-semibold text-primary">{minutesToHours(dtr.overtimeMinutes)}</td>
                      <td className="px-4 py-3 text-warning font-medium">{Math.round(dtr.lateMinutes)}</td>
                      <td className="px-4 py-3 text-warning font-medium">{Math.round(dtr.undertimeMinutes)}</td>
                      <td className="px-4 py-3">{statusBadge(dtr.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {dtr.status === 'pending' && (role === 'supervisor' || role === 'admin') && (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                isLoading={actionLoadingId === dtr.id}
                                onClick={(e) => { e.stopPropagation(); handleApprove(dtr); }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                isLoading={actionLoadingId === dtr.id}
                                onClick={(e) => { e.stopPropagation(); handleReject(dtr); }}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); handleView(dtr); }}
                          >
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <p>
                  Showing {((filters.page ?? 1) - 1) * (filters.limit || 20) + 1} to {Math.min((filters.page ?? 1) * (filters.limit || 20), total)} of {total} records
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* DTR Detail Modal */}
      {selectedDTR && (
        <Modal
          open={showDetail}
          title={`DTR Detail: ${selectedDTR.traineeId.slice(0, 8)}... - ${formatDateFull(selectedDTR.date)}`}
          size="lg"
          onClose={() => { setShowDetail(false); setSelectedDTR(null); }}
        >
          {detailLoading ? (
            <div className="space-y-4">
              <Skeleton variant="rectangular" height={80} className="rounded-xl" />
              <Skeleton variant="rectangular" height={80} className="rounded-xl" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-muted/40 rounded-xl border border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Clock className="w-3.5 h-3.5" /> Time In
                  </div>
                  <p className="text-lg font-bold text-foreground">{selectedDTR.actualTimeIn ? formatTime12(selectedDTR.actualTimeIn) : '—'}</p>
                </div>
                <div className="p-3.5 bg-muted/40 rounded-xl border border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Clock className="w-3.5 h-3.5" /> Time Out
                  </div>
                  <p className="text-lg font-bold text-foreground">{selectedDTR.actualTimeOut ? formatTime12(selectedDTR.actualTimeOut) : '—'}</p>
                </div>
                <div className="p-3.5 bg-muted/40 rounded-xl border border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <FileCheck className="w-3.5 h-3.5 text-primary" /> Regular (hrs)
                  </div>
                  <p className="text-lg font-bold text-foreground">{minutesToHours(selectedDTR.regularMinutes)}</p>
                </div>
                <div className="p-3.5 bg-muted/40 rounded-xl border border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <FileCheck className="w-3.5 h-3.5 text-primary" /> OT (hrs)
                  </div>
                  <p className="text-lg font-bold text-primary">{minutesToHours(selectedDTR.overtimeMinutes)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-muted/40 rounded-xl border border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning" /> Late (min)
                  </div>
                  <p className="text-lg font-bold text-warning">{Math.round(selectedDTR.lateMinutes)} min</p>
                </div>
                <div className="p-3.5 bg-muted/40 rounded-xl border border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning" /> Undertime (min)
                  </div>
                  <p className="text-lg font-bold text-warning">{Math.round(selectedDTR.undertimeMinutes)} min</p>
                </div>
                <div className="p-3.5 bg-muted/40 rounded-xl border border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Moon className="w-3.5 h-3.5 text-primary" /> Night Diff (min)
                  </div>
                  <p className="text-lg font-bold text-primary">{selectedDTR.nightDiffMinutes}</p>
                </div>
                <div className="p-3.5 bg-muted/40 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <div className="mt-1">{statusBadge(selectedDTR.status)}</div>
                </div>
              </div>

              {selectedDTR.status === 'pending' && (role === 'supervisor' || role === 'admin') && (
                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <Button variant="destructive" onClick={() => handleReject(selectedDTR)}>
                    Reject
                  </Button>
                  <Button variant="primary" onClick={() => handleApprove(selectedDTR)}>
                    Approve
                  </Button>
                </div>
              )}

              {corrections.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-3">Correction Requests ({corrections.length})</h4>
                  <div className="space-y-3">
                    {corrections.map((c) => (
                      <div key={c.id} className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-muted text-foreground">{c.status}</span>
                          <span className="text-xs text-muted-foreground">by {c.requestedBy.slice(0, 8)}...</span>
                        </div>
                        <p className="text-sm text-foreground"><span className="text-muted-foreground">Reason:</span> {c.reason}</p>
                        <div className="text-xs text-muted-foreground">
                          Proposed: {c.proposedValue.actualTimeIn ? formatTime12(c.proposedValue.actualTimeIn) : '—'} – {c.proposedValue.actualTimeOut ? formatTime12(c.proposedValue.actualTimeOut) : '—'}
                        </div>
                        {c.status === 'pending' && (role === 'supervisor' || role === 'admin') && (
                          <div className="flex gap-2 pt-2">
                            <Button size="sm" variant="primary" onClick={() => handleCorrectionAction(c, 'approve')}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve Correction
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleCorrectionAction(c, 'reject')}>
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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