import { useState, useEffect, useCallback } from 'react';
import { calculateDTR, getDTRSummary, createCorrectionRequest } from '../services/dtrService';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/shared/components/Toast';
import { FormField, FormTextarea } from '@/shared/components/FormField';
import { required } from '@/shared/utils/validators';
import { formatDateFull, formatTime12 } from '@/shared/utils/dateUtils';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { Modal } from '@/shared/components/Modal';
import { Calculator } from 'lucide-react';
import type { DTREntry, DTRSummary } from '../types';

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
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}

export function TraineeDTRView() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [summary, setSummary] = useState<DTRSummary | null>(null);
  const [entries, setEntries] = useState<DTREntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [period, setPeriod] = useState({ start: '', end: '' });
  const [showCorrection, setShowCorrection] = useState<DTREntry | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionReasonError, setCorrectionReasonError] = useState<string | null>(null);
  const [correctionTimeIn, setCorrectionTimeIn] = useState('');
  const [correctionTimeOut, setCorrectionTimeOut] = useState('');
  const [traineeId, setTraineeId] = useState<string | null>(null);
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  const validateReason = required('Reason is required');

  const refresh = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      let resolvedId = traineeId;
      if (!resolvedId) {
        const { getFirestoreInstancePublic } = await import('@/config/firebase');
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const db = getFirestoreInstancePublic();

        const traineeSnap = await getDocs(
          query(collection(db, 'trainees'), where('userId', '==', user!.uid), where('status', '==', 'active'))
        );
        if (traineeSnap.empty) return;

        resolvedId = traineeSnap.docs[0].id;
        setTraineeId(resolvedId);
      }

      const now = new Date();
      const start = period.start ? new Date(period.start).getTime() : new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const end = period.end ? new Date(period.end).getTime() : new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime();

      const summaryData = await getDTRSummary(resolvedId, start, end);
      setSummary(summaryData);
      setEntries(summaryData.entries);
    } catch (err) {
      console.error('Failed to load DTR:', err);
      setError('Failed to load DTR data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, traineeId, period]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCalculate = async () => {
    if (!user?.uid) return;
    setCalculating(true);
    try {
      let resolvedId = traineeId;
      if (!resolvedId) {
        const { getFirestoreInstancePublic } = await import('@/config/firebase');
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const db = getFirestoreInstancePublic();

        const traineeSnap = await getDocs(
          query(collection(db, 'trainees'), where('userId', '==', user.uid), where('status', '==', 'active'))
        );
        if (traineeSnap.empty) return;

        resolvedId = traineeSnap.docs[0].id;
        setTraineeId(resolvedId);
      }
      const start = period.start ? new Date(period.start).getTime() : new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      const end = period.end ? new Date(period.end).getTime() : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getTime();

      await calculateDTR({ traineeId: resolvedId, startDate: start, endDate: end, forceRecalc: true, timezoneOffsetMinutes: new Date().getTimezoneOffset() });
      addToast('success', 'DTR successfully recalculated');
      await refresh();
    } catch (err) {
      console.error('Calculate DTR failed:', err);
      addToast('error', 'Failed to calculate DTR: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setCalculating(false);
    }
  };

  const handleCorrectionSubmit = async (entry: DTREntry) => {
    const reasonError = validateReason(correctionReason);
    setCorrectionReasonError(reasonError);
    if (reasonError) return;
    setSubmittingCorrection(true);
    try {
      const entryDate = new Date(entry.date);
      const proposedTimeIn = correctionTimeIn
        ? new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate(), ...correctionTimeIn.split(':').map(Number)).getTime()
        : entry.actualTimeIn;
      const proposedTimeOut = correctionTimeOut
        ? new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate(), ...correctionTimeOut.split(':').map(Number)).getTime()
        : entry.actualTimeOut;
      await createCorrectionRequest(entry.id, correctionReason, {
        actualTimeIn: proposedTimeIn,
        actualTimeOut: proposedTimeOut,
      });
      addToast('success', 'Correction request submitted');
      setShowCorrection(null);
      setCorrectionReason('');
      setCorrectionReasonError(null);
      setCorrectionTimeIn('');
      setCorrectionTimeOut('');
      await refresh();
    } catch (err) {
      console.error('Correction request failed:', err);
      addToast('error', 'Failed to submit correction request');
    } finally {
      setSubmittingCorrection(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="rectangular" height={100} className="rounded-xl" />
        <Skeleton variant="rectangular" height={220} className="rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-card border border-border rounded-xl gap-4">
        <p className="text-destructive text-sm font-medium">{error}</p>
        <Button onClick={refresh} variant="primary" size="sm">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-foreground">My Daily Time Record (DTR)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Track your regular hours, overtime, tardiness, and submit corrections</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={period.start}
                onChange={(e) => setPeriod(p => ({ ...p, start: e.target.value }))}
                aria-label="Start date"
                className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={period.end}
                onChange={(e) => setPeriod(p => ({ ...p, end: e.target.value }))}
                aria-label="End date"
                className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button
              onClick={handleCalculate}
              isLoading={calculating}
              variant="primary"
              size="md"
            >
              <Calculator className="w-4 h-4 mr-1.5" />
              Calculate DTR
            </Button>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-4 bg-muted/40 rounded-xl border border-border">
              <p className="text-xs text-muted-foreground">Total Regular Hours</p>
              <p className="text-2xl font-bold text-foreground mt-1">{minutesToHours(summary.totalRegularHours * 60)} hrs</p>
            </div>
            <div className="p-4 bg-muted/40 rounded-xl border border-border">
              <p className="text-xs text-muted-foreground">Total Overtime</p>
              <p className="text-2xl font-bold text-primary mt-1">{minutesToHours(summary.totalOvertimeHours * 60)} hrs</p>
            </div>
            <div className="p-4 bg-muted/40 rounded-xl border border-border">
              <p className="text-xs text-muted-foreground">Total Late</p>
              <p className="text-2xl font-bold text-warning mt-1">{Math.round(summary.totalLateMinutes)} min</p>
            </div>
            <div className="p-4 bg-muted/40 rounded-xl border border-border">
              <p className="text-xs text-muted-foreground">Total Undertime</p>
              <p className="text-2xl font-bold text-warning mt-1">{Math.round(summary.totalUndertimeMinutes)} min</p>
            </div>
          </div>
        )}

        {entries.length === 0 ? (
          <EmptyState
            title="No DTR entries for this period"
            description="Click 'Calculate DTR' above to generate and compute your time records."
          />
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="space-y-3 md:hidden">
              {entries.map((entry) => (
                <div key={entry.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{formatDateFull(entry.date)}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.actualTimeIn ? formatTime12(entry.actualTimeIn) : '—'} – {entry.actualTimeOut ? formatTime12(entry.actualTimeOut) : '—'}
                      </p>
                    </div>
                    {statusBadge(entry.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border">
                    <div>
                      <span className="text-muted-foreground">Regular:</span>{' '}
                      <span className="font-semibold text-foreground">{minutesToHours(entry.regularMinutes)} hrs</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">OT:</span>{' '}
                      <span className="font-semibold text-primary">{minutesToHours(entry.overtimeMinutes)} hrs</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Late:</span>{' '}
                      <span className="font-semibold text-warning">{Math.round(entry.lateMinutes)} min</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Undertime:</span>{' '}
                      <span className="font-semibold text-warning">{Math.round(entry.undertimeMinutes)} min</span>
                    </div>
                  </div>

                  {entry.status === 'draft' && (
                    <div className="pt-1 flex justify-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setShowCorrection(entry);
                          setCorrectionReason('');
                          setCorrectionReasonError(null);
                          setCorrectionTimeIn('');
                          setCorrectionTimeOut('');
                        }}
                      >
                        Request Correction
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time In</th>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time Out</th>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Regular (hrs)</th>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">OT (hrs)</th>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Late (min)</th>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Undertime (min)</th>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="h-[44px] px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="h-[44px] hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{formatDateFull(entry.date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{entry.actualTimeIn ? formatTime12(entry.actualTimeIn) : '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{entry.actualTimeOut ? formatTime12(entry.actualTimeOut) : '—'}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{minutesToHours(entry.regularMinutes)}</td>
                      <td className="px-4 py-3 font-semibold text-primary">{minutesToHours(entry.overtimeMinutes)}</td>
                      <td className="px-4 py-3 text-warning font-medium">{Math.round(entry.lateMinutes)}</td>
                      <td className="px-4 py-3 text-warning font-medium">{Math.round(entry.undertimeMinutes)}</td>
                      <td className="px-4 py-3">{statusBadge(entry.status)}</td>
                      <td className="px-4 py-3 text-right">
                        {entry.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setShowCorrection(entry);
                              setCorrectionReason('');
                              setCorrectionReasonError(null);
                              setCorrectionTimeIn('');
                              setCorrectionTimeOut('');
                            }}
                          >
                            Request Correction
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
      </div>

      {/* Correction Modal */}
      {showCorrection && (
        <Modal
          open={Boolean(showCorrection)}
          title={`Request Correction: ${formatDateFull(showCorrection.date)}`}
          onClose={() => {
            setShowCorrection(null);
            setCorrectionReason('');
            setCorrectionReasonError(null);
            setCorrectionTimeIn('');
            setCorrectionTimeOut('');
          }}
        >
          <div className="space-y-4">
            <div className="p-3 bg-muted/40 rounded-lg border border-border text-xs text-muted-foreground">
              Current Logged Time: <span className="font-semibold text-foreground">{showCorrection.actualTimeIn ? formatTime12(showCorrection.actualTimeIn) : '—'}</span> to <span className="font-semibold text-foreground">{showCorrection.actualTimeOut ? formatTime12(showCorrection.actualTimeOut) : '—'}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="correction-time-in" className="block text-xs font-medium text-foreground mb-1.5">
                  Corrected Time In
                </label>
                <input
                  id="correction-time-in"
                  type="time"
                  value={correctionTimeIn}
                  onChange={(e) => setCorrectionTimeIn(e.target.value)}
                  className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="correction-time-out" className="block text-xs font-medium text-foreground mb-1.5">
                  Corrected Time Out
                </label>
                <input
                  id="correction-time-out"
                  type="time"
                  value={correctionTimeOut}
                  onChange={(e) => setCorrectionTimeOut(e.target.value)}
                  className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <FormField id="correction-reason" label="Reason for Correction" error={correctionReasonError ?? undefined}>
              <FormTextarea
                id="correction-reason"
                value={correctionReason}
                onValueChange={(value) => {
                  setCorrectionReason(value);
                  setCorrectionReasonError(null);
                }}
                placeholder="Explain why this correction is requested (e.g. forgot to scan time out, system issue)..."
                aria-label="Reason for correction"
                error={correctionReasonError ?? undefined}
                className="min-h-[90px] resize-none"
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCorrection(null);
                  setCorrectionReason('');
                  setCorrectionReasonError(null);
                  setCorrectionTimeIn('');
                  setCorrectionTimeOut('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                isLoading={submittingCorrection}
                onClick={() => handleCorrectionSubmit(showCorrection)}
              >
                Submit Request
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}