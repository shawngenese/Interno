import { useState, useEffect, useCallback } from 'react';
import { calculateDTR, getDTRSummary, createCorrectionRequest } from '../services/dtrService';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/shared/components/Toast';
import { formatDateFull, formatTime12 } from '@/shared/utils/dateUtils';
import type { DTREntry, DTRSummary } from '../types';

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
  const [correctionTimeIn, setCorrectionTimeIn] = useState('');
  const [correctionTimeOut, setCorrectionTimeOut] = useState('');
  const [traineeId, setTraineeId] = useState<string | null>(null);

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
      await refresh();
    } catch (err) {
      console.error('Calculate DTR failed:', err);
      addToast('error', 'Failed to calculate DTR: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setCalculating(false);
    }
  };

  const handleCorrectionSubmit = async (entry: DTREntry) => {
    if (!correctionReason.trim()) return;
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
      setShowCorrection(null);
      setCorrectionReason('');
      setCorrectionTimeIn('');
      setCorrectionTimeOut('');
      await refresh();
    } catch (err) {
      console.error('Correction request failed:', err);
      addToast('error', 'Failed to submit correction request');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500 dark:text-red-400">{error}</p>
        <button
          onClick={refresh}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-[#121212] dark:text-white">My DTR</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2">
              <input
                type="date"
                value={period.start}
                onChange={(e) => setPeriod(p => ({ ...p, start: e.target.value }))}
                aria-label="Start date"
                className="px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
              />
              <span className="flex items-center text-[#757575]">to</span>
              <input
                type="date"
                value={period.end}
                onChange={(e) => setPeriod(p => ({ ...p, end: e.target.value }))}
                aria-label="End date"
                className="px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
              />
            </div>
            <button
              onClick={handleCalculate}
              disabled={calculating}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {calculating ? 'Calculating...' : 'Calculate DTR'}
            </button>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-[#F5F5F5] dark:bg-[#1E1E1E]/50 rounded-lg">
              <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Total Regular Hours</p>
              <p className="text-2xl font-bold text-[#121212] dark:text-white">{minutesToHours(summary.totalRegularHours * 60)}</p>
            </div>
            <div className="p-4 bg-[#F5F5F5] dark:bg-[#1E1E1E]/50 rounded-lg">
              <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Total Overtime Hours</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{minutesToHours(summary.totalOvertimeHours * 60)}</p>
            </div>
            <div className="p-4 bg-[#F5F5F5] dark:bg-[#1E1E1E]/50 rounded-lg">
              <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Total Late (min)</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.totalLateMinutes}</p>
            </div>
            <div className="p-4 bg-[#F5F5F5] dark:bg-[#1E1E1E]/50 rounded-lg">
              <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">Total Undertime (min)</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{summary.totalUndertimeMinutes}</p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F5F5] dark:bg-[#3A3A3A]/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Time In</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Time Out</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Regular (hrs)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">OT (hrs)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Late (min)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Undertime (min)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5D5D5] dark:divide-[#3A3A3A]">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#757575] dark:text-[#9E9E9E]">
                    No DTR entries for this period. Click "Calculate DTR" to generate.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/50">
                    <td className="px-4 py-3 text-sm text-[#121212] dark:text-white">{formatDateFull(entry.date)}</td>
                    <td className="px-4 py-3 text-sm text-[#757575] dark:text-[#9E9E9E]">{entry.actualTimeIn ? formatTime12(entry.actualTimeIn) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#757575] dark:text-[#9E9E9E]">{entry.actualTimeOut ? formatTime12(entry.actualTimeOut) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#121212] dark:text-white">{minutesToHours(entry.regularMinutes)}</td>
                    <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400">{minutesToHours(entry.overtimeMinutes)}</td>
                    <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{entry.lateMinutes}</td>
                    <td className="px-4 py-3 text-sm text-orange-600 dark:text-orange-400">{entry.undertimeMinutes}</td>
                    <td className="px-4 py-3 text-sm">{statusBadge(entry.status)}</td>
                    <td className="px-4 py-3 text-right">
                      {entry.status === 'draft' && (
                        <button
                          onClick={() => { setShowCorrection(entry); setCorrectionReason(''); setCorrectionTimeIn(''); setCorrectionTimeOut(''); }}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Request Correction
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCorrection && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="correction-modal-title"
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowCorrection(null); setCorrectionReason(''); setCorrectionTimeIn(''); setCorrectionTimeOut(''); } }}
        >
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div
            className="bg-white dark:bg-[#1E1E1E] rounded-xl p-6 max-w-md w-full"
            onKeyDown={(e) => { if (e.key === 'Escape') { setShowCorrection(null); setCorrectionReason(''); setCorrectionTimeIn(''); setCorrectionTimeOut(''); } }}
          >
            <h3 id="correction-modal-title" className="text-lg font-semibold text-[#121212] dark:text-white mb-4">Request Correction for {formatDateFull(showCorrection.date)}</h3>
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E] mb-4">
              Current: {showCorrection.actualTimeIn ? formatTime12(showCorrection.actualTimeIn) : '—'} - {showCorrection.actualTimeOut ? formatTime12(showCorrection.actualTimeOut) : '—'}
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="correction-time-in" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">Corrected Time In</label>
                <input
                  id="correction-time-in"
                  type="time"
                  value={correctionTimeIn}
                  onChange={(e) => setCorrectionTimeIn(e.target.value)}
                  className="w-full px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="correction-time-out" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">Corrected Time Out</label>
                <input
                  id="correction-time-out"
                  type="time"
                  value={correctionTimeOut}
                  onChange={(e) => setCorrectionTimeOut(e.target.value)}
                  className="w-full px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
                />
              </div>
            </div>
            <textarea
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="Reason for correction (e.g., forgot to time out, system error, etc.)"
              aria-label="Reason for correction"
              className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white min-h-[80px] resize-none"
              required
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowCorrection(null); setCorrectionReason(''); setCorrectionTimeIn(''); setCorrectionTimeOut(''); }}
                aria-label="Close"
                className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCorrectionSubmit(showCorrection)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}