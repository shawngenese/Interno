import { useState, useEffect, useMemo } from 'react';
import { adminService } from '../services/adminService';
import type { User, Company, Department } from '../types';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required } from '@/shared/utils/validators';
import { FormField, FormInput, FormSelect } from '@/shared/components/FormField';

interface CoordinatorFormProps {
  editingId?: string;
  editingCoordinatorId?: string;
  onCancel?: () => void;
  onSaved?: () => void;
}

export function CoordinatorForm({ editingId, editingCoordinatorId, onCancel, onSaved }: CoordinatorFormProps) {
  const isEditing = !!editingCoordinatorId;

  const validationRules = useMemo(() => {
    if (isEditing) {
      return {
        companyId: [required('Company is required')],
        departmentId: [required('Department is required')],
      };
    }
    return {};
  }, [isEditing]);

  const {
    formData,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
  } = useFormValidation(
    {
      userId: '',
      companyId: '',
      departmentId: '',
      email: '',
      displayName: '',
      password: '',
    },
    validationRules,
  );

  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [existingUsers, setExistingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useExistingUser, setUseExistingUser] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const result = await adminService.listCompanies({ limit: 100 });
        setCompanies(result.data);

        if (isEditing && editingCoordinatorId) {
          const [coordinator, user] = await Promise.all([
            adminService.getCoordinator(editingCoordinatorId),
            editingId ? adminService.getUser(editingId) : null,
          ]);
          setFieldValue('userId', coordinator.userId);
          setFieldValue('companyId', coordinator.companyId);
          setFieldValue('departmentId', coordinator.departmentId);
          setFieldValue('email', user?.email ?? '');
          setFieldValue('displayName', user?.displayName ?? '');
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [isEditing, editingCoordinatorId, editingId]);

  useEffect(() => {
    if (formData.companyId) {
      const loadDepartments = async () => {
        try {
          const result = await adminService.listDepartments({ companyId: formData.companyId as string, limit: 100 });
          setDepartments(result.data);
        } catch (err) {
          console.error('Failed to load departments:', err);
        }
      };
      loadDepartments();
    } else {
      setDepartments([]);
    }
  }, [formData.companyId]);

  useEffect(() => {
    if (useExistingUser && formData.companyId) {
      const loadUsers = async () => {
        try {
          const result = await adminService.listUsers({ role: 'coordinator', companyId: formData.companyId as string, limit: 100 });
          setExistingUsers(result.data);
        } catch (err) {
          console.error('Failed to load users:', err);
        }
      };
      loadUsers();
    }
  }, [useExistingUser, formData.companyId]);

  const onSubmit = async (data: typeof formData) => {
    setError(null);
    setSaving(true);

    try {
      if (isEditing && editingCoordinatorId) {
        await adminService.updateCoordinator(editingCoordinatorId, {
          companyId: data.companyId as string,
          departmentId: data.departmentId as string,
        });
      } else if (useExistingUser) {
        await adminService.createCoordinator({
          userId: data.userId as string,
          companyId: data.companyId as string,
          departmentId: data.departmentId as string,
        });
      } else {
        const user = await adminService.createUser({
          email: data.email as string,
          displayName: data.displayName as string,
          role: 'coordinator',
          companyId: data.companyId as string,
          departmentId: data.departmentId as string,
          password: data.password as string,
        });
        await adminService.createCoordinator({
          userId: user.id,
          companyId: data.companyId as string,
          departmentId: data.departmentId as string,
        });
      }
      onSaved?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save coordinator';
      setError(message);
    } finally {
      setSaving(false);
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
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-[#121212] dark:text-white mb-6">
        {isEditing ? 'Edit Coordinator' : 'Add Coordinator'}
      </h2>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {isEditing && formData.displayName && (
          <div className="p-3 bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 rounded-lg border border-[#D5D5D5] dark:border-[#555555]">
            <p className="text-sm font-medium text-[#121212] dark:text-white">{formData.displayName as string}</p>
            <p className="text-xs text-[#757575] dark:text-[#9E9E9E]">{formData.email as string}</p>
          </div>
        )}

        {!isEditing && (
          <div className="flex items-center gap-3 mb-4">
            <label className="flex items-center gap-2 text-sm text-[#3A3A3A] dark:text-[#BDBDBD]">
              <input
                type="checkbox"
                checked={useExistingUser}
                onChange={(e) => setUseExistingUser(e.target.checked)}
                className="rounded border-[#BDBDBD] dark:border-[#555555]"
              />
              Link to existing user account
            </label>
          </div>
        )}

        {useExistingUser ? (
          <FormField
            id="userId"
            label="User"
            required
            error={touched.userId ? errors.userId : undefined}
          >
            <FormSelect
              id="userId"
              value={formData.userId as string}
              onValueChange={handleChange('userId')}
              onBlur={handleBlur('userId')}
              error={touched.userId ? errors.userId : undefined}
            >
              <option value="">Select User</option>
              {existingUsers.map(user => (
                <option key={user.id} value={user.id}>{user.displayName} ({user.email})</option>
              ))}
            </FormSelect>
          </FormField>
        ) : (
          <>
            <FormField
              id="email"
              label="Email"
              required
              error={touched.email ? errors.email : undefined}
            >
              <FormInput
                type="email"
                id="email"
                value={formData.email as string}
                onValueChange={handleChange('email')}
                onBlur={handleBlur('email')}
                error={touched.email ? errors.email : undefined}
                placeholder="coordinator@example.com"
              />
            </FormField>
            <FormField
              id="displayName"
              label="Display Name"
              required
              error={touched.displayName ? errors.displayName : undefined}
            >
              <FormInput
                type="text"
                id="displayName"
                value={formData.displayName as string}
                onValueChange={handleChange('displayName')}
                onBlur={handleBlur('displayName')}
                error={touched.displayName ? errors.displayName : undefined}
                placeholder="Juan Dela Cruz"
              />
            </FormField>
            <FormField
              id="password"
              label="Password"
              required
              error={touched.password ? errors.password : undefined}
            >
              <FormInput
                type="password"
                id="password"
                value={formData.password as string}
                onValueChange={handleChange('password')}
                onBlur={handleBlur('password')}
                error={touched.password ? errors.password : undefined}
                placeholder="At least 6 characters"
              />
            </FormField>
          </>
        )}

        <FormField
          id="companyId"
          label="Company"
          required
          error={touched.companyId ? errors.companyId : undefined}
        >
          <FormSelect
            id="companyId"
            value={formData.companyId as string}
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

        <FormField
          id="departmentId"
          label="Department"
          required
          error={touched.departmentId ? errors.departmentId : undefined}
        >
          <FormSelect
            id="departmentId"
            value={formData.departmentId as string}
            onValueChange={handleChange('departmentId')}
            onBlur={handleBlur('departmentId')}
            error={touched.departmentId ? errors.departmentId : undefined}
          >
            <option value="">Select Department</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </FormSelect>
        </FormField>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : (isEditing ? 'Update Coordinator' : 'Create Coordinator')}
          </button>
        </div>
      </form>
    </div>
  );
}
