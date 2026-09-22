import { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required, email, minLength } from '@/shared/utils/validators';
import { FormField, FormInput, FormSelect } from '@/shared/components/FormField';
import type { UserFormData, UserRole, Company, Department, Supervisor } from '../types';

interface UserFormProps {
  editingId?: string;
  defaultRole?: string;
  onCancel?: () => void;
  onSaved?: () => void;
}

export function UserForm({ editingId, defaultRole, onCancel, onSaved }: UserFormProps) {
  const isEditing = !!editingId;

  const validationRules = {
    email: [required('Email is required'), email()],
    displayName: [required('Display name is required')],
    role: [required('Role is required')],
    companyId: [required('Company is required')],
    ...(!isEditing ? { password: [required('Password is required'), minLength(6)] } : {}),
  };

  const {
    formData,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit: handleSubmitValidation,
    setFormData,
  } = useFormValidation<UserFormData>(
    {
      email: '',
      displayName: '',
      role: (defaultRole as UserRole) || 'trainee',
      companyId: '',
      departmentId: '',
      supervisorId: '',
      password: '',
    },
    validationRules,
  );

  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
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

  const loadDepartments = async (companyId: string) => {
    try {
      const result = await adminService.listDepartments({ companyId, limit: 100 });
      setDepartments(result.data);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const loadSupervisors = async (companyId: string) => {
    try {
      const result = await adminService.listSupervisors({ companyId, limit: 100 });
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

  const loadUser = async (userId: string) => {
    try {
      const user = await adminService.getUser(userId);
      setFormData({
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        companyId: user.companyId,
        departmentId: user.departmentId || '',
        supervisorId: user.supervisorId || '',
        password: '',
      });
    } catch (err) {
      setError('Failed to load user');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
    if (isEditing && editingId) {
      loadUser(editingId);
    }
  }, [editingId, isEditing]);

  useEffect(() => {
    if (formData.companyId) {
      loadDepartments(formData.companyId);
      loadSupervisors(formData.companyId);
    } else {
      setDepartments([]);
      setSupervisors([]);
    }
  }, [formData.companyId]);

  const onSubmit = async (data: UserFormData) => {
    setError(null);
    setSaving(true);

    try {
      if (isEditing && editingId) {
        await adminService.updateUser(editingId, data);
      } else {
        await adminService.createUser(data);
      }
      onSaved?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save user';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
  };

  useEffect(() => {
    if (!isEditing) {
      setLoading(false);
    }
  }, [isEditing]);

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
        {isEditing ? 'Edit User' : `Create ${formData.role.charAt(0).toUpperCase() + formData.role.slice(1)}`}
      </h2>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmitValidation(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField id="email" label="Email" required error={touched.email ? errors.email : undefined} className="sm:col-span-2">
            <FormInput
              type="email"
              id="email"
              value={formData.email}
              onValueChange={handleChange('email')}
              onBlur={handleBlur('email')}
              error={touched.email ? errors.email : undefined}
              placeholder="user@example.com"
              disabled={isEditing}
            />
          </FormField>

          <FormField id="displayName" label="Display Name" required error={touched.displayName ? errors.displayName : undefined}>
            <FormInput
              type="text"
              id="displayName"
              value={formData.displayName}
              onValueChange={handleChange('displayName')}
              onBlur={handleBlur('displayName')}
              error={touched.displayName ? errors.displayName : undefined}
              placeholder="John Doe"
            />
          </FormField>

          <FormField id="role" label="Role" required error={touched.role ? errors.role : undefined}>
            <FormSelect
              id="role"
              value={formData.role}
              onValueChange={handleChange('role')}
              onBlur={handleBlur('role')}
              error={touched.role ? errors.role : undefined}
            >
              <option value="trainee">Trainee</option>
              <option value="supervisor">Supervisor</option>
              <option value="coordinator">Coordinator</option>
              <option value="admin">Admin</option>
            </FormSelect>
          </FormField>

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

          <FormField id="departmentId" label="Department" error={touched.departmentId ? errors.departmentId : undefined}>
            <FormSelect
              id="departmentId"
              value={formData.departmentId}
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

          <FormField id="supervisorId" label="Supervisor" error={touched.supervisorId ? errors.supervisorId : undefined}>
            <FormSelect
              id="supervisorId"
              value={formData.supervisorId}
              onValueChange={handleChange('supervisorId')}
              onBlur={handleBlur('supervisorId')}
              error={touched.supervisorId ? errors.supervisorId : undefined}
            >
              <option value="">Select Supervisor</option>
              {supervisors.map(sup => (
                <option key={sup.id} value={sup.id}>{sup.userName || sup.userEmail || sup.id}</option>
              ))}
            </FormSelect>
          </FormField>

          {!isEditing && (
            <FormField id="password" label="Password" required error={touched.password ? errors.password : undefined} className="sm:col-span-2">
              <FormInput
                type="password"
                id="password"
                value={formData.password}
                onValueChange={handleChange('password')}
                onBlur={handleBlur('password')}
                error={touched.password ? errors.password : undefined}
                placeholder="At least 6 characters"
              />
            </FormField>
          )}
        </div>

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
