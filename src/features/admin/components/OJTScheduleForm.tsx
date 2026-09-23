import { useEffect, useState, useCallback } from 'react';
import { adminService } from '../services/adminService';
import type { OJTScheduleFormData, WorkSchedule, Company } from '../types';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required, minValue } from '@/shared/utils/validators';
import { FormField, FormInput, FormSelect, FormTextarea } from '@/shared/components/FormField';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';

interface OJTScheduleFormProps {
  editingId?: string;
  viewOnly?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
}

export function OJTScheduleForm({ editingId, viewOnly, onCancel, onSaved }: OJTScheduleFormProps) {
  const isEditing = !!editingId;

  const { formData, errors, touched, handleChange, handleBlur, handleSubmit, setFieldValue, setFormData } =
    useFormValidation<OJTScheduleFormData>(
      {
        companyId: '',
        name: '',
        startDate: new Date(),
        endDate: new Date(),
        requiredHours: 480,
        workScheduleId: '',
        description: '',
      },
      {
        companyId: [required('Company is required')],
        name: [required('Schedule name is required')],
        startDate: [required('Start date is required')],
        endDate: [required('End date is required')],
        requiredHours: [required('Required hours is required'), minValue(1, 'Required hours must be at least 1')],
        workScheduleId: [required('Work schedule is required')],
      },
    );

  const [companies, setCompanies] = useState<Company[]>([]);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const to12Hour = (time24: string) => {
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const loadWorkSchedules = async (companyId?: string) => {
    try {
      const result = await adminService.listWorkSchedules({ limit: 100, companyId: companyId || undefined });
      setWorkSchedules(result.data);
    } catch (err) {
      console.error('Failed to load work schedules:', err);
    }
  };

  const loadSchedule = useCallback(async (scheduleId: string) => {
    try {
      const schedule = await adminService.getOJTSchedule(scheduleId);
      setFormData({
        companyId: schedule.companyId,
        name: schedule.name,
        startDate: new Date(schedule.startDate.seconds * 1000),
        endDate: new Date(schedule.endDate.seconds * 1000),
        requiredHours: schedule.requiredHours,
        workScheduleId: schedule.workScheduleId,
        description: schedule.description || '',
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

  useEffect(() => {
    if (formData.companyId) {
      loadWorkSchedules(formData.companyId);
    } else {
      setWorkSchedules([]);
    }
  }, [formData.companyId]);

  const onSubmit = async (data: OJTScheduleFormData) => {
    setError(null);
    setSaving(true);

    try {
      const submitData = {
        ...data,
        startDate: data.startDate instanceof Date ? data.startDate : new Date(data.startDate),
        endDate: data.endDate instanceof Date ? data.endDate : new Date(data.endDate),
      };

      if (isEditing && editingId) {
        await adminService.updateOJTSchedule(editingId, submitData);
      } else {
        await adminService.createOJTSchedule(submitData);
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
          <div className="grid grid-cols-2 gap-4">
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

      <FormField id="companyId" label="Company" required error={touched.companyId ? errors.companyId : undefined}>
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

      <FormField id="name" label="Schedule Name" required error={touched.name ? errors.name : undefined}>
        <FormInput
          type="text"
          id="name"
          value={formData.name}
          onValueChange={handleChange('name')}
          onBlur={handleBlur('name')}
          disabled={viewOnly}
          error={touched.name ? errors.name : undefined}
          placeholder="e.g. Summer 2025 Internship Batch"
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField id="startDate" label="Start Date" required error={touched.startDate ? errors.startDate : undefined}>
          <FormInput
            type="date"
            id="startDate"
            value={formData.startDate instanceof Date ? formData.startDate.toISOString().split('T')[0] : ''}
            onValueChange={(val) => setFieldValue('startDate', new Date(val))}
            onBlur={handleBlur('startDate')}
            disabled={viewOnly}
            error={touched.startDate ? errors.startDate : undefined}
          />
        </FormField>

        <FormField id="endDate" label="End Date" required error={touched.endDate ? errors.endDate : undefined}>
          <FormInput
            type="date"
            id="endDate"
            value={formData.endDate instanceof Date ? formData.endDate.toISOString().split('T')[0] : ''}
            onValueChange={(val) => setFieldValue('endDate', new Date(val))}
            onBlur={handleBlur('endDate')}
            disabled={viewOnly}
            error={touched.endDate ? errors.endDate : undefined}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField id="requiredHours" label="Required Hours" required error={touched.requiredHours ? errors.requiredHours : undefined}>
          <FormInput
            type="number"
            id="requiredHours"
            value={formData.requiredHours}
            onValueChange={(val) => setFieldValue('requiredHours', parseInt(val) || 0)}
            onBlur={handleBlur('requiredHours')}
            disabled={viewOnly}
            error={touched.requiredHours ? errors.requiredHours : undefined}
            placeholder="480"
          />
        </FormField>

        <FormField id="workScheduleId" label="Work Schedule" required error={touched.workScheduleId ? errors.workScheduleId : undefined}>
          <FormSelect
            id="workScheduleId"
            value={formData.workScheduleId}
            onValueChange={handleChange('workScheduleId')}
            onBlur={handleBlur('workScheduleId')}
            disabled={viewOnly || !formData.companyId}
            error={touched.workScheduleId ? errors.workScheduleId : undefined}
          >
            <option value="">Select Work Schedule</option>
            {workSchedules.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name} ({to12Hour(ws.timeIn)} - {to12Hour(ws.timeOut)})
              </option>
            ))}
          </FormSelect>
        </FormField>
      </div>

      <FormField id="description" label="Description">
        <FormTextarea
          id="description"
          value={formData.description}
          onValueChange={handleChange('description')}
          onBlur={handleBlur('description')}
          rows={3}
          disabled={viewOnly}
          placeholder="Program goals, requirements, and deliverables"
        />
      </FormField>

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
