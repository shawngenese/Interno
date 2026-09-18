import { useState } from 'react';
import { createLeaveRequest } from '../services/leaveService';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { LeaveFormValues, LeaveType, LeaveRequest } from '../types';

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'sick', label: 'Sick Leave' },
  { value: 'emergency', label: 'Emergency Leave' },
  { value: 'personal', label: 'Personal Leave' },
  { value: 'school_activity', label: 'School Activity' },
  { value: 'company_holiday', label: 'Company Holiday' },
  { value: 'other', label: 'Other' },
];

interface LeaveFormProps {
  onSaved?: (leave: LeaveRequest) => void;
  onCancel?: () => void;
}

export function LeaveForm({ onSaved, onCancel }: LeaveFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<LeaveType>('sick');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;

    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date cannot be before start date');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const db = getFirestoreInstancePublic();
      const traineeSnap = await getDocs(
        query(collection(db, 'trainees'), where('userId', '==', user.uid), where('status', '==', 'active')),
      );
      if (traineeSnap.empty) {
        setError('No active trainee profile found');
        setLoading(false);
        return;
      }
      const traineeDoc = traineeSnap.docs[0];
      const traineeData = traineeDoc.data();
      const traineeId = traineeDoc.id;
      const companyId = traineeData.companyId || '';

      const values: LeaveFormValues = { type, startDate, endDate, reason: reason.trim() };
      const result = await createLeaveRequest(traineeId, companyId, values);
      onSaved?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit leave request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">Leave Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as LeaveType)}
          className="w-full rounded-lg border border-[#BDBDBD] dark:border-[#555555] bg-white dark:bg-[#1E1E1E] px-3 py-2 text-sm dark:text-white"
        >
          {LEAVE_TYPES.map((lt) => (
            <option key={lt.value} value={lt.value}>{lt.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            min={today}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-[#BDBDBD] dark:border-[#555555] bg-white dark:bg-[#1E1E1E] px-3 py-2 text-sm dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            min={startDate || today}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-[#BDBDBD] dark:border-[#555555] bg-white dark:bg-[#1E1E1E] px-3 py-2 text-sm dark:text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-[#BDBDBD] dark:border-[#555555] bg-white dark:bg-[#1E1E1E] px-3 py-2 text-sm dark:text-white"
          placeholder="Describe the reason for your leave..."
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Request'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-[#BDBDBD] dark:border-[#555555] px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] hover:bg-[#F5F5F5] dark:hover:bg-[#1E1E1E]"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
