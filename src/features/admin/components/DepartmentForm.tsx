import { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required } from '@/shared/utils/validators';
import { FormField, FormInput, FormSelect, FormTextarea } from '@/shared/components/FormField';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import type { DepartmentFormData, Company, Supervisor } from '../types';

interface DepartmentFormProps {
  editingId?: string;
  onCancel?: () => void;
  onSaved?: () => void;
}

export function DepartmentForm({ editingId, onCancel, onSaved }: DepartmentFormProps) {
  const isEditing = !!editingId;

  const {
    formData,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    setFormData,
  } = useFormValidation<DepartmentFormData>(
    {
      companyId: '',
      name: '',
      description: '',
      headSupervisorId: '',
    },
    {
      companyId: [required('Company is required')],
      name: [required('Department name is required')],
    },
  );

  const [companies, setCompanies] = useState<Company[]>([]);
  const [supervisors, setSupervisors] = useState<(Supervisor & { userName?: string; userEmail?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCompanies = async () => {
    try {
      const result = await adminService.listCompanies({ limit: 100 });
      setCompanies(result.data);
    } catch (err) {
      console.error('Failed to load companies:', err);
    }
  };

  const loadDepartment = async (departmentId: string) => {
    try {
      const department = await adminService.getDepartment(departmentId);
      setFormData({
        companyId: department.companyId,
        name: department.name,
        description: department.description || '',
        headSupervisorId: department.headSupervisorId || '',
      });
    } catch (err) {
      setError('Failed to load department');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
    if (isEditing && editingId) {
      loadDepartment(editingId);
    } else {
      setLoading(false);
    }
  }, [editingId, isEditing]);

  useEffect(() => {
    if (formData.companyId) {
      const loadSupervisors = async () => {
        try {
          const result = await adminService.listSupervisors({ companyId: formData.companyId, limit: 100 });
          const resolved = await Promise.all(
            result.data.map(async (s) => {
              const [userName, userEmail] = await Promise.all([
                resolveDocName('users', s.userId, 'displayName'),
                resolveDocName('users', s.userId, 'email'),
              ]);
              return { ...s, userName, userEmail };
            }),
          );
          setSupervisors(resolved);
        } catch (err) {
          console.error('Failed to load supervisors:', err);
        }
      };
      loadSupervisors();
    } else {
      setSupervisors([]);
    }
  }, [formData.companyId]);

  const onSubmit = async (data: DepartmentFormData) => {
    setError(null);
    setSaving(true);

    try {
      if (isEditing && editingId) {
        await adminService.updateDepartment(editingId, data);
      } else {
        await adminService.createDepartment(data);
      }
      onSaved?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save department';
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
          <Skeleton variant="rectangular" height={80} />
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
          error={touched.companyId ? errors.companyId : undefined}
        >
          <option value="">Select Company</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </FormSelect>
      </FormField>

      <FormField id="name" label="Department Name" required error={touched.name ? errors.name : undefined}>
        <FormInput
          type="text"
          id="name"
          value={formData.name}
          onValueChange={handleChange('name')}
          onBlur={handleBlur('name')}
          error={touched.name ? errors.name : undefined}
          placeholder="e.g. Engineering, Human Resources"
        />
      </FormField>

      <FormField id="description" label="Description">
        <FormTextarea
          id="description"
          value={formData.description}
          onValueChange={handleChange('description')}
          onBlur={handleBlur('description')}
          rows={3}
          placeholder="Department overview and responsibilities"
        />
      </FormField>

      <FormField id="headSupervisorId" label="Head Supervisor (Optional)">
        <FormSelect
          id="headSupervisorId"
          value={formData.headSupervisorId}
          onValueChange={handleChange('headSupervisorId')}
          onBlur={handleBlur('headSupervisorId')}
        >
          <option value="">None</option>
          {supervisors.map((sup) => (
            <option key={sup.id} value={sup.userId}>
              {sup.userName || sup.userEmail || sup.userId}
            </option>
          ))}
        </FormSelect>
      </FormField>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" isLoading={saving}>
          Save
        </Button>
      </div>
    </form>
  );
}
