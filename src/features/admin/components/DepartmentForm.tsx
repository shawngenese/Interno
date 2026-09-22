import { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required } from '@/shared/utils/validators';
import { FormField, FormInput, FormSelect, FormTextarea } from '@/shared/components/FormField';
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
        {isEditing ? 'Edit Department' : 'Create Department'}
      </h2>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField id="companyId" label="Company" required error={touched.companyId ? errors.companyId : undefined}>
          <FormSelect
            id="companyId"
            value={formData.companyId}
            onValueChange={handleChange('companyId')}
            onBlur={handleBlur('companyId')}
            error={touched.companyId ? errors.companyId : undefined}
          >
            <option value="">Select Company</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>{company.name}</option>
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
            placeholder="Department Name"
          />
        </FormField>

        <FormField id="description" label="Description">
          <FormTextarea
            id="description"
            value={formData.description}
            onValueChange={handleChange('description')}
            onBlur={handleBlur('description')}
            rows={3}
            placeholder="Department description"
          />
        </FormField>

        <FormField id="headSupervisorId" label="Head Supervisor (optional)">
          <FormSelect
            id="headSupervisorId"
            value={formData.headSupervisorId}
            onValueChange={handleChange('headSupervisorId')}
            onBlur={handleBlur('headSupervisorId')}
          >
            <option value="">None</option>
            {supervisors.map(sup => (
              <option key={sup.id} value={sup.userId}>{sup.userName || sup.userEmail || sup.userId}</option>
            ))}
          </FormSelect>
        </FormField>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A]">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
          </button>
        </div>
      </form>
    </div>
  );
}
