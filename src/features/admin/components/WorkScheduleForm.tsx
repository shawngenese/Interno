import { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import type { WorkScheduleFormData, Company } from '../types';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required, minValue } from '@/shared/utils/validators';
import { FormField, FormInput, FormSelect } from '@/shared/components/FormField';

interface WorkScheduleFormProps {
  editingId?: string;
  viewOnly?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
}

const DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const validationRules = {
  companyId: [required('Company is required')],
  name: [required('Schedule name is required')],
  timeIn: [required('Time in is required')],
  timeOut: [required('Time out is required')],
  breakDurationMinutes: [required('Break duration is required'), minValue(0)],
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

  const loadSchedule = async (scheduleId: string) => {
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
  };

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
  }, [editingId, isEditing]);

  const handleWorkDayToggle = (day: number) => {
    setFormData(prev => {
      if (prev.workDays.length === 1 && prev.workDays.includes(day)) {
        return prev;
      }
      const newWorkDays = prev.workDays.includes(day)
        ? prev.workDays.filter(d => d !== day)
        : [...prev.workDays, day].sort((a, b) => a - b);
      return { ...prev, workDays: newWorkDays };
    });
  };

  const onSubmit = async (data: WorkScheduleFormData) => {
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

  const handleCancel = () => {
    onCancel?.();
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
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-[#121212] dark:text-white mb-6">
        {viewOnly ? 'View Work Schedule' : isEditing ? 'Edit Work Schedule' : 'Create Work Schedule'}
      </h2>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
            placeholder="Work Schedule Name"
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
            label="Break Duration (min)"
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

        <div>
          <div className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-2">
            Work Days <span className="text-red-500">*</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {DAY_OPTIONS.map(day => (
              <label
                key={day.value}
                title={formData.workDays.length === 1 && formData.workDays.includes(day.value) ? 'At least one work day is required' : undefined}
                className={`inline-flex items-center px-3 py-2 border rounded-lg transition-colors ${
                  viewOnly
                    ? 'cursor-not-allowed opacity-50'
                    : 'cursor-pointer'
                } ${
                  formData.workDays.includes(day.value)
                    ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300'
                    : 'bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 border-[#D5D5D5] dark:border-[#555555] text-[#3A3A3A] dark:text-[#BDBDBD] hover:bg-[#EFEFEF] dark:hover:bg-[#3A3A3A]'
                }`}
              >
                <input
                  type="checkbox"
                  value={day.value}
                  checked={formData.workDays.includes(day.value)}
                  onChange={() => handleWorkDayToggle(day.value)}
                  disabled={viewOnly}
                  className="w-4 h-4 text-blue-600 border-[#BDBDBD] rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="ml-2 text-sm">{day.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A]">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            {viewOnly ? 'Close' : 'Cancel'}
          </button>
          {!viewOnly && (
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
