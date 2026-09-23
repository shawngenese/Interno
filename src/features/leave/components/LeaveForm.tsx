import { useState } from 'react';
import { createLeaveRequest } from '../services/leaveService';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/shared/components/ui/Button';
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
      {error && (
        <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="leave-type" className="block text-xs font-semibold text-foreground mb-1.5">
          Leave Type
        </label>
        <select
          id="leave-type"
          value={type}
          onChange={(e) => setType(e.target.value as LeaveType)}
          className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {LEAVE_TYPES.map((lt) => (
            <option key={lt.value} value={lt.value}>{lt.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="start-date" className="block text-xs font-semibold text-foreground mb-1.5">
            Start Date
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            min={today}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label htmlFor="end-date" className="block text-xs font-semibold text-foreground mb-1.5">
            End Date
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            min={startDate || today}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div>
        <label htmlFor="leave-reason" className="block text-xs font-semibold text-foreground mb-1.5">
          Reason for Leave
        </label>
        <textarea
          id="leave-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full p-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          placeholder="Describe the reason for your leave request..."
        />
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          isLoading={loading}
        >
          Submit Request
        </Button>
      </div>
    </form>
  );
}
