import { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required, email, minLength } from '@/shared/utils/validators';
import { FormField, FormInput, FormSelect } from '@/shared/components/FormField';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
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
    email: [required('Email is required'), email('Enter a valid email')],
    displayName: [required('Display name is required')],
    role: [required('Role is required')],
    companyId: [required('Company is required')],
    ...(!isEditing ? { password: [required('Password is required'), minLength(8, 'Password must be 8+ characters')] } : {}),
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
    } else {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton variant="text" width="50%" height={24} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton variant="rectangular" height={40} className="sm:col-span-2" />
          <Skeleton variant="rectangular" height={40} />
          <Skeleton variant="rectangular" height={40} />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitValidation(onSubmit)} className="space-y-4">
      {error && (
        <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

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
            placeholder="Jane Doe"
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
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </FormSelect>
        </FormField>

        {formData.role !== 'admin' && (
          <FormField id="departmentId" label="Department" error={touched.departmentId ? errors.departmentId : undefined}>
            <FormSelect
              id="departmentId"
              value={formData.departmentId}
              onValueChange={handleChange('departmentId')}
              onBlur={handleBlur('departmentId')}
              error={touched.departmentId ? errors.departmentId : undefined}
            >
              <option value="">Select Department (Optional)</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </FormSelect>
          </FormField>
        )}

        {formData.role === 'trainee' && (
          <FormField id="supervisorId" label="Supervisor" error={touched.supervisorId ? errors.supervisorId : undefined} className="sm:col-span-2">
            <FormSelect
              id="supervisorId"
              value={formData.supervisorId}
              onValueChange={handleChange('supervisorId')}
              onBlur={handleBlur('supervisorId')}
              error={touched.supervisorId ? errors.supervisorId : undefined}
            >
              <option value="">Select Supervisor (Optional)</option>
              {supervisors.map((sup) => (
                <option key={sup.id} value={sup.id}>{sup.userName || sup.userEmail || sup.id}</option>
              ))}
            </FormSelect>
          </FormField>
        )}

        {!isEditing && (
          <FormField id="password" label="Password" required error={touched.password ? errors.password : undefined} className="sm:col-span-2">
            <FormInput
              type="password"
              id="password"
              value={formData.password}
              onValueChange={handleChange('password')}
              onBlur={handleBlur('password')}
              error={touched.password ? errors.password : undefined}
              placeholder="Minimum 8 characters"
            />
          </FormField>
        )}
      </div>

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
