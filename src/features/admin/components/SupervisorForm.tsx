import { useState, useEffect, useMemo } from 'react';
import { adminService } from '../services/adminService';
import type { User, Company, Department } from '../types';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required, email, minLength } from '@/shared/utils/validators';
import { FormField, FormInput, FormSelect } from '@/shared/components/FormField';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';

interface SupervisorFormProps {
  editingId?: string;
  editingSupervisorId?: string;
  onCancel?: () => void;
  onSaved?: () => void;
}

export function SupervisorForm({ editingId, editingSupervisorId, onCancel, onSaved }: SupervisorFormProps) {
  const isEditing = !!editingSupervisorId;

  const [useExistingUser, setUseExistingUser] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [existingUsers, setExistingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validationRules = useMemo(() => {
    if (isEditing) {
      return {
        companyId: [required('Company is required')],
        departmentId: [required('Department is required')],
      };
    }
    if (useExistingUser) {
      return {
        userId: [required('User is required')],
        companyId: [required('Company is required')],
        departmentId: [required('Department is required')],
      };
    }
    return {
      email: [required('Email is required'), email('Enter a valid email')],
      displayName: [required('Display name is required')],
      password: [required('Password is required'), minLength(6, 'Password must be 6+ characters')],
      companyId: [required('Company is required')],
      departmentId: [required('Department is required')],
    };
  }, [isEditing, useExistingUser]);

  const {
    formData,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    setFormData,
  } = useFormValidation<{
    userId: string;
    companyId: string;
    departmentId: string;
    email: string;
    displayName: string;
    password: string;
  }>(
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

  useEffect(() => {
    const init = async () => {
      try {
        const result = await adminService.listCompanies({ limit: 100 });
        setCompanies(result.data);

        if (isEditing && editingSupervisorId) {
          const [supervisor, user] = await Promise.all([
            adminService.getSupervisor(editingSupervisorId),
            editingId ? adminService.getUser(editingId) : null,
          ]);
          setFormData((prev) => ({
            ...prev,
            userId: supervisor.userId,
            companyId: supervisor.companyId,
            departmentId: supervisor.departmentId,
            email: user?.email ?? '',
            displayName: user?.displayName ?? '',
          }));
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [isEditing, editingSupervisorId, editingId, setFormData]);

  useEffect(() => {
    if (formData.companyId) {
      const loadDepartments = async () => {
        try {
          const result = await adminService.listDepartments({ companyId: formData.companyId, limit: 100 });
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
          const result = await adminService.listUsers({ role: 'supervisor', companyId: formData.companyId, limit: 100 });
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
      if (isEditing && editingSupervisorId) {
        await adminService.updateSupervisor(editingSupervisorId, {
          companyId: data.companyId,
          departmentId: data.departmentId,
        });
      } else if (useExistingUser) {
        await adminService.createSupervisor({
          userId: data.userId,
          companyId: data.companyId,
          departmentId: data.departmentId,
        });
      } else {
        const user = await adminService.createUser({
          email: data.email,
          displayName: data.displayName,
          role: 'supervisor',
          companyId: data.companyId,
          departmentId: data.departmentId,
          password: data.password,
        });
        await adminService.createSupervisor({
          userId: user.id,
          companyId: data.companyId,
          departmentId: data.departmentId,
        });
      }
      onSaved?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save supervisor';
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {isEditing && formData.displayName && (
        <div className="p-3 bg-muted/40 rounded-lg border border-border">
          <p className="text-sm font-medium text-foreground">{formData.displayName}</p>
          <p className="text-xs text-muted-foreground">{formData.email}</p>
        </div>
      )}

      {!isEditing && (
        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border border-border">
          <input
            type="checkbox"
            id="useExistingUser"
            checked={useExistingUser}
            onChange={(e) => setUseExistingUser(e.target.checked)}
            className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
          />
          <label htmlFor="useExistingUser" className="text-sm font-medium text-foreground cursor-pointer">
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
            value={formData.userId}
            onValueChange={handleChange('userId')}
            onBlur={handleBlur('userId')}
            error={touched.userId ? errors.userId : undefined}
          >
            <option value="">Select User</option>
            {existingUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.email})
              </option>
            ))}
          </FormSelect>
        </FormField>
      ) : !isEditing && (
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
              value={formData.email}
              onValueChange={handleChange('email')}
              onBlur={handleBlur('email')}
              error={touched.email ? errors.email : undefined}
              placeholder="supervisor@example.com"
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
              value={formData.displayName}
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
              value={formData.password}
              onValueChange={handleChange('password')}
              onBlur={handleBlur('password')}
              error={touched.password ? errors.password : undefined}
              placeholder="Minimum 6 characters"
            />
          </FormField>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <FormField
          id="departmentId"
          label="Department"
          required
          error={touched.departmentId ? errors.departmentId : undefined}
        >
          <FormSelect
            id="departmentId"
            value={formData.departmentId}
            onValueChange={handleChange('departmentId')}
            onBlur={handleBlur('departmentId')}
            error={touched.departmentId ? errors.departmentId : undefined}
          >
            <option value="">Select Department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </FormSelect>
        </FormField>
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
