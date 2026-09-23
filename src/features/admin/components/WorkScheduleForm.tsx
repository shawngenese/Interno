import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/adminService';
import type { WorkScheduleFormData, Company } from '../types';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required, minValue } from '@/shared/utils/validators';
import { FormField, FormInput, FormSelect } from '@/shared/components/FormField';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';

interface WorkScheduleFormProps {
  editingId?: string;
  viewOnly?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
}

const DAY_OPTIONS = [
  { value: 0, label: 'Sun', fullLabel: 'Sunday' },
  { value: 1, label: 'Mon', fullLabel: 'Monday' },
  { value: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { value: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { value: 4, label: 'Thu', fullLabel: 'Thursday' },
  { value: 5, label: 'Fri', fullLabel: 'Friday' },
  { value: 6, label: 'Sat', fullLabel: 'Saturday' },
];

const validationRules = {
  companyId: [required('Company is required')],
  name: [required('Schedule name is required')],
  timeIn: [required('Time in is required')],
  timeOut: [required('Time out is required')],
  breakDurationMinutes: [required('Break duration is required'), minValue(0, 'Break duration cannot be negative')],
};

const initialValues: WorkScheduleFormData = {
  companyId: '',
  name: '',
  timeIn: '08:00',
  timeOut: '17:00',
  breakDurationMinutes: 60,
  workDays: [1, 2, 3, 4, 5],
};

export function WorkScheduleForm({ editingId, viewOnly, onCancel, onSaved }: WorkScheduleFormProps) {
  const isEditing = !!editingId;

  const {
    formData,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFormData,
  } = useFormValidation<WorkScheduleFormData>(initialValues, validationRules);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSchedule = useCallback(async (scheduleId: string) => {
    try {
      const schedule = await adminService.getWorkSchedule(scheduleId);
      setFormData({
        companyId: schedule.companyId,
        name: schedule.name,
        timeIn: schedule.timeIn,
        timeOut: schedule.timeOut,
        breakDurationMinutes: schedule.breakDurationMinutes,
        workDays: schedule.workDays,
      });
    } catch (err) {
      setError('Failed to load schedule');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [setFormData]);

  useEffect(() => {
    const init = async () => {
      try {
        const result = await adminService.listCompanies({ limit: 100 });
        setCompanies(result.data);
      } catch (err) {
        console.error('Failed to load companies:', err);
      }
      if (isEditing && editingId) {
        await loadSchedule(editingId);
      } else {
        setLoading(false);
      }
    };
    init();
  }, [editingId, isEditing, loadSchedule]);

  const handleWorkDayToggle = (day: number) => {
    if (viewOnly) return;
    setFormData((prev) => {
      if (prev.workDays.length === 1 && prev.workDays.includes(day)) {
        return prev;
      }
      const newWorkDays = prev.workDays.includes(day)
        ? prev.workDays.filter((d) => d !== day)
        : [...prev.workDays, day].sort((a, b) => a - b);
      return { ...prev, workDays: newWorkDays };
    });
  };

  const onSubmit = async (data: WorkScheduleFormData) => {
    if (data.workDays.length === 0) {
      setError('At least one working day is required');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      if (isEditing && editingId) {
        await adminService.updateWorkSchedule(editingId, data);
      } else {
        await adminService.createWorkSchedule(data);
      }
      onSaved?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save schedule';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton variant="text" width="50%" height={24} />
        <div className="space-y-4">
          <Skeleton variant="rectangular" height={40} />
          <Skeleton variant="rectangular" height={40} />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton variant="rectangular" height={40} />
            <Skeleton variant="rectangular" height={40} />
            <Skeleton variant="rectangular" height={40} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <FormField
        id="companyId"
        label="Company"
        required
        error={touched.companyId ? errors.companyId : undefined}
      >
        <FormSelect
          id="companyId"
          value={formData.companyId}
          onValueChange={handleChange('companyId')}
          onBlur={handleBlur('companyId')}
          disabled={viewOnly}
          error={touched.companyId ? errors.companyId : undefined}
        >
          <option value="">Select Company</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </FormSelect>
      </FormField>

      <FormField
        id="name"
        label="Schedule Name"
        required
        error={touched.name ? errors.name : undefined}
      >
        <FormInput
          type="text"
          id="name"
          value={formData.name}
          onValueChange={handleChange('name')}
          onBlur={handleBlur('name')}
          disabled={viewOnly}
          error={touched.name ? errors.name : undefined}
          placeholder="e.g. Standard Weekday (8am - 5pm)"
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField
          id="timeIn"
          label="Time In"
          required
          error={touched.timeIn ? errors.timeIn : undefined}
        >
          <FormInput
            type="time"
            id="timeIn"
            value={formData.timeIn}
            onValueChange={handleChange('timeIn')}
            onBlur={handleBlur('timeIn')}
            disabled={viewOnly}
            error={touched.timeIn ? errors.timeIn : undefined}
          />
        </FormField>

        <FormField
          id="timeOut"
          label="Time Out"
          required
          error={touched.timeOut ? errors.timeOut : undefined}
        >
          <FormInput
            type="time"
            id="timeOut"
            value={formData.timeOut}
            onValueChange={handleChange('timeOut')}
            onBlur={handleBlur('timeOut')}
            disabled={viewOnly}
            error={touched.timeOut ? errors.timeOut : undefined}
          />
        </FormField>

        <FormField
          id="breakDurationMinutes"
          label="Break (Minutes)"
          required
          error={touched.breakDurationMinutes ? errors.breakDurationMinutes : undefined}
        >
          <FormInput
            type="number"
            id="breakDurationMinutes"
            value={formData.breakDurationMinutes}
            onValueChange={(val) => setFieldValue('breakDurationMinutes', parseInt(val) || 0)}
            onBlur={handleBlur('breakDurationMinutes')}
            disabled={viewOnly}
            error={touched.breakDurationMinutes ? errors.breakDurationMinutes : undefined}
            placeholder="60"
          />
        </FormField>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-foreground mb-2">
          Working Days <span className="text-destructive">*</span>
        </legend>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {DAY_OPTIONS.map((day) => {
            const isSelected = formData.workDays.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => handleWorkDayToggle(day.value)}
                disabled={viewOnly}
                className={`min-h-[44px] min-w-[44px] px-2 py-2.5 rounded-lg border text-sm font-medium flex flex-col items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-ring ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                } ${viewOnly ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                title={day.fullLabel}
              >
                <span>{day.label}</span>
              </button>
            );
          })}
        </div>
        {formData.workDays.length === 0 && (
          <p className="text-xs text-destructive mt-1.5">Please select at least one working day.</p>
        )}
      </fieldset>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Button variant="secondary" type="button" onClick={onCancel}>
          {viewOnly ? 'Close' : 'Cancel'}
        </Button>
        {!viewOnly && (
          <Button variant="primary" type="submit" isLoading={saving}>
            Save
          </Button>
        )}
      </div>
    </form>
  );
}
