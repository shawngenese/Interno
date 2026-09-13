import { useState, useEffect, useCallback } from 'react';
import { calculateDTR, getDTRSummary, createCorrectionRequest } from '../services/dtrService';
import { useAuth } from '@/features/auth/AuthProvider';
import type { DTREntry, DTRSummary } from '../types';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

function minutesToHours(mins: number): string {
  return (mins / 60).toFixed(2);
}

function statusBadge(status: DTREntry['status']): React.ReactNode {
  const styles: Record<DTREntry['status'], string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    corrected: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };
  return <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[status]}`}>{status}</span>;
}

export function TraineeDTRView() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DTRSummary | null>(null);
  const [entries, setEntries] = useState<DTREntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [period, setPeriod] = useState({ start: '', end: '' });
  const [showCorrection, setShowCorrection] = useState<DTREntry | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');

  const refresh = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const { getFirestoreInstancePublic } = await import('@/config/firebase');
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const db = getFirestoreInstancePublic();

      const traineeSnap = await getDocs(
        query(collection(db, 'trainees'), where('userId', '==', user!.uid), where('status', '==', 'active'))
      );
      if (traineeSnap.empty) return;

      const traineeId = traineeSnap.docs[0].id;

      // Default to current month if no period set
      const now = new Date();
      const start = period.start ? new Date(period.start).getTime() : new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const end = period.end ? new Date(period.end).getTime() : new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime();

      const summaryData = await getDTRSummary(traineeId, start, end);
      setSummary(summaryData);
      setEntries(summaryData.entries);
    } catch (err) {
      console.error('Failed to load DTR:', err);
    } finally {
      setLoading(false);
    }
  }, [user, period]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCalculate = async () => {
    if (!user?.uid) return;
    setCalculating(true);
    try {
      const { getFirestoreInstancePublic } = await import('@/config/firebase');
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const db = getFirestoreInstancePublic();

      const traineeSnap = await getDocs(
        query(collection(db, 'trainees'), where('userId', '==', user.uid), where('status', '==', 'active'))
      );
      if (traineeSnap.empty) return;

      const traineeId = traineeSnap.docs[0].id;
      const start = period.start ? new Date(period.start).getTime() : new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      const end = period.end ? new Date(period.end).getTime() : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getTime();

      await calculateDTR({ traineeId, startDate: start, endDate: end, forceRecalc: true });
      await refresh();
    } catch (err) {
      console.error('Calculate DTR failed:', err);
      alert('Failed to calculate DTR: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setCalculating(false);
    }
  };

  const handleCorrectionSubmit = async (entry: DTREntry) => {
    if (!correctionReason.trim()) return;
    try {
      await createCorrectionRequest(entry.id, correctionReason, {
        actualTimeIn: entry.actualTimeIn,
        actualTimeOut: entry.actualTimeOut,
      });
      setShowCorrection(null);
      setCorrectionReason('');
      await refresh();
    } catch (err) {
      console.error('Correction request failed:', err);
      alert('Failed to submit correction request');
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

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My DTR</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2">
              <input
                type="date"
                value={period.start}
                onChange={(e) => setPeriod(p => ({ ...p, start: e.target.value }))}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="flex items-center text-gray-500">to</span>
              <input
                type="date"
                value={period.end}
                onChange={(e) => setPeriod(p => ({ ...p, end: e.target.value }))}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Regular Hours</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{minutesToHours(summary.totalRegularHours * 60)}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Overtime Hours</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{minutesToHours(summary.totalOvertimeHours * 60)}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Late (min)</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.totalLateMinutes}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Undertime (min)</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{summary.totalUndertimeMinutes}</p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Time In</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Time Out</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Regular (hrs)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">OT (hrs)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Late (min)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Undertime (min)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No DTR entries for this period. Click "Calculate DTR" to generate.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{formatDate(entry.date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{entry.actualTimeIn ? formatTime(entry.actualTimeIn) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{entry.actualTimeOut ? formatTime(entry.actualTimeOut) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{minutesToHours(entry.regularMinutes)}</td>
                    <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400">{minutesToHours(entry.overtimeMinutes)}</td>
                    <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{entry.lateMinutes}</td>
                    <td className="px-4 py-3 text-sm text-orange-600 dark:text-orange-400">{entry.undertimeMinutes}</td>
                    <td className="px-4 py-3 text-sm">{statusBadge(entry.status)}</td>
                    <td className="px-4 py-3 text-right">
                      {entry.status === 'draft' && (
                        <button
                          onClick={() => { setShowCorrection(entry); setCorrectionReason(''); }}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Request Correction for {formatDate(showCorrection.date)}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Current: {showCorrection.actualTimeIn ? formatTime(showCorrection.actualTimeIn) : '—'} - {showCorrection.actualTimeOut ? formatTime(showCorrection.actualTimeOut) : '—'}
            </p>
            <textarea
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="Reason for correction (e.g., forgot to time out, system error, etc.)"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[80px] resize-none"
              required
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowCorrection(null); setCorrectionReason(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
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