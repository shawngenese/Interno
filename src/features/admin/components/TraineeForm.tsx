import { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required } from '@/shared/utils/validators';
import { FormField, FormInput, FormSelect } from '@/shared/components/FormField';
import type { TraineeFormData, Company, Department, Supervisor, Trainee, User, WorkSchedule } from '../types';

interface TraineeFormProps {
  editingId?: string;
  viewOnly?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
}

export function TraineeForm({ editingId, viewOnly, onCancel, onSaved }: TraineeFormProps) {
  const isEditing = !!editingId;

  const {
    formData,
    errors,
    touched,
    handleChange: hookHandleChange,
    handleBlur,
    handleSubmit,
    setFormData,
  } = useFormValidation<TraineeFormData>(
    {
      userId: '',
      companyId: '',
      departmentId: '',
      supervisorId: '',
      scheduleId: '',
      status: 'active',
      ojtStatus: 'pending',
      placementType: 'internal',
      externalCompanyId: '',
      externalSupervisorId: '',
      placementNotes: '',
      profile: {
        studentId: '',
        course: '',
        school: '',
        yearLevel: '',
        emergencyContact: {
          name: '',
          relationship: '',
          phone: '',
        },
      },
    },
    {
      companyId: [required('Company is required')],
      departmentId: [required('Department is required')],
      scheduleId: [required('Work schedule is required')],
    },
  );

  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [supervisors, setSupervisors] = useState<(Supervisor & { userName?: string; userEmail?: string })[]>([]);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [existingUsers, setExistingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useExistingUser, setUseExistingUser] = useState(false);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

  const [newUserEmailTouched, setNewUserEmailTouched] = useState(false);
  const [newUserDisplayNameTouched, setNewUserDisplayNameTouched] = useState(false);
  const [newUserPasswordTouched, setNewUserPasswordTouched] = useState(false);

  const handleChange = (field: string) => (value: string) => {
    if (field.startsWith('profile.')) {
      const profileField = field.slice(8) as keyof TraineeFormData['profile'];
      setFormData(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          [profileField]: value,
        } as TraineeFormData['profile'],
      }));
    } else if (field.startsWith('emergencyContact.')) {
      const ecField = field.slice(17) as 'name' | 'relationship' | 'phone';
      setFormData(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          emergencyContact: {
            name: prev.profile?.emergencyContact?.name || '',
            relationship: prev.profile?.emergencyContact?.relationship || '',
            phone: prev.profile?.emergencyContact?.phone || '',
            [ecField]: value,
          },
        },
      }));
    } else if (field === 'companyId') {
      const selectedCompany = companies.find(c => c.id === value);
      const isExternal = selectedCompany?.type === 'external';
      setFormData(prev => ({
        ...prev,
        companyId: value,
        placementType: isExternal ? 'external' : 'internal',
        externalCompanyId: isExternal ? value : '',
        externalSupervisorId: isExternal ? prev.externalSupervisorId : '',
      }));
    } else {
      hookHandleChange(field as keyof TraineeFormData)(value);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const result = await adminService.listCompanies({ limit: 100 });
        setCompanies(result.data);

        if (isEditing && editingId) {
          const trainee = await adminService.getTrainee(editingId);
          setFormData({
            userId: trainee.userId,
            companyId: trainee.companyId,
            departmentId: trainee.departmentId,
            supervisorId: trainee.supervisorId || '',
            scheduleId: trainee.scheduleId || '',
            status: trainee.status,
            ojtStatus: trainee.ojtStatus,
            placementType: trainee.placementType || 'internal',
            externalCompanyId: trainee.externalCompanyId || '',
            externalSupervisorId: trainee.externalSupervisorId || '',
            placementNotes: trainee.placementNotes || '',
            profile: {
              studentId: trainee.profile?.studentId || '',
              course: trainee.profile?.course || '',
              school: trainee.profile?.school || '',
              yearLevel: trainee.profile?.yearLevel || '',
              emergencyContact: {
                name: trainee.profile?.emergencyContact?.name || '',
                relationship: trainee.profile?.emergencyContact?.relationship || '',
                phone: trainee.profile?.emergencyContact?.phone || '',
              },
            },
          });
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [isEditing, editingId, setFormData]);

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

  useEffect(() => {
    if (formData.companyId) {
      const loadWorkSchedules = async () => {
        try {
          const result = await adminService.listWorkSchedules({ companyId: formData.companyId, limit: 100 });
          setWorkSchedules(result.data);
        } catch (err) {
          console.error('Failed to load work schedules:', err);
        }
      };
      loadWorkSchedules();
    } else {
      setWorkSchedules([]);
    }
  }, [formData.companyId]);

  useEffect(() => {
    if (useExistingUser && formData.companyId) {
      const loadUsers = async () => {
        try {
          const result = await adminService.listUsers({ role: 'trainee', companyId: formData.companyId, limit: 100 });
          setExistingUsers(result.data);
        } catch (err) {
          console.error('Failed to load users:', err);
        }
      };
      loadUsers();
    }
  }, [useExistingUser, formData.companyId]);

  const onSubmit = async (data: TraineeFormData) => {
    setError(null);
    setSaving(true);

    try {
      if (isEditing && editingId) {
        await adminService.updateTrainee(editingId, {
          companyId: data.companyId,
          departmentId: data.departmentId,
          supervisorId: data.supervisorId,
          scheduleId: data.scheduleId,
          status: data.status,
          ojtStatus: data.ojtStatus,
          profile: data.profile,
        } as Partial<Trainee>);
      } else {
        let userId = data.userId;

        if (useExistingUser) {
          if (!userId) {
            setError('Select a user');
            setSaving(false);
            return;
          }
        } else {
          if (!newUserEmail || !newUserDisplayName || !newUserPassword) {
            if (!newUserEmail) setNewUserEmailTouched(true);
            if (!newUserDisplayName) setNewUserDisplayNameTouched(true);
            if (!newUserPassword) setNewUserPasswordTouched(true);
            setError('Email, display name, and password are required');
            setSaving(false);
            return;
          }
          const user = await adminService.createUser({
            email: newUserEmail,
            displayName: newUserDisplayName,
            role: 'trainee',
            companyId: data.companyId,
            departmentId: data.departmentId,
            password: newUserPassword,
          });
          userId = user.id;
        }

        await adminService.createTrainee({
          ...data,
          userId,
        });
      }
      onSaved?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save trainee';
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
        {viewOnly ? 'View Trainee Profile' : isEditing ? 'Edit Trainee Profile' : 'Add Trainee'}
      </h2>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {!isEditing && (
          <div className="flex items-center gap-3 mb-4">
            <label className="flex items-center gap-2 text-sm text-[#3A3A3A] dark:text-[#BDBDBD]">
              <input
                type="checkbox"
                checked={useExistingUser}
                onChange={(e) => setUseExistingUser(e.target.checked)}
                disabled={viewOnly}
                className="rounded border-[#BDBDBD] dark:border-[#555555]"
              />
              Link to existing user account
            </label>
          </div>
        )}

        {!isEditing && (useExistingUser ? (
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
              disabled={viewOnly}
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
              id="newEmail"
              label="Email"
              required
              error={newUserEmailTouched && !newUserEmail ? 'Email is required' : undefined}
            >
              <FormInput
                type="email"
                id="newEmail"
                value={newUserEmail}
                onValueChange={setNewUserEmail}
                onBlur={() => setNewUserEmailTouched(true)}
                error={newUserEmailTouched && !newUserEmail ? 'Email is required' : undefined}
                disabled={viewOnly}
                placeholder="trainee@example.com"
              />
            </FormField>
            <FormField
              id="newDisplayName"
              label="Display Name"
              required
              error={newUserDisplayNameTouched && !newUserDisplayName ? 'Display name is required' : undefined}
            >
              <FormInput
                type="text"
                id="newDisplayName"
                value={newUserDisplayName}
                onValueChange={setNewUserDisplayName}
                onBlur={() => setNewUserDisplayNameTouched(true)}
                error={newUserDisplayNameTouched && !newUserDisplayName ? 'Display name is required' : undefined}
                disabled={viewOnly}
                placeholder="Juan Dela Cruz"
              />
            </FormField>
            <FormField
              id="newPassword"
              label="Password"
              required
              error={newUserPasswordTouched && !newUserPassword ? 'Password is required' : newUserPasswordTouched && newUserPassword.length < 6 ? 'Password must be at least 6 characters' : undefined}
            >
              <FormInput
                type="password"
                id="newPassword"
                value={newUserPassword}
                onValueChange={setNewUserPassword}
                onBlur={() => setNewUserPasswordTouched(true)}
                error={newUserPasswordTouched && !newUserPassword ? 'Password is required' : newUserPasswordTouched && newUserPassword.length < 6 ? 'Password must be at least 6 characters' : undefined}
                disabled={viewOnly}
                placeholder="At least 6 characters"
              />
            </FormField>
          </>
        ))}

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
              disabled={viewOnly}
            >
              <option value="">Select Company</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name} ({company.type === 'external' ? 'External' : 'Internal'})
                </option>
              ))}
            </FormSelect>
          </FormField>

          <FormField id="placementType" label="Placement Type">
            <div className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-[#F5F5F5] dark:bg-[#2A2A2A] text-[#121212] dark:text-white">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${
                formData.placementType === 'external'
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
              }`}>
                {formData.placementType === 'external' ? 'External' : 'Internal'}
              </span>
              {!formData.companyId && (
                <span className="text-xs text-[#9E9E9E] ml-2">Select a company first</span>
              )}
            </div>
          </FormField>

          {formData.placementType === 'external' && (
            <FormField id="externalSupervisorId" label="External Supervisor ID">
              <FormInput
                type="text"
                id="externalSupervisorId"
                value={formData.externalSupervisorId}
                onValueChange={handleChange('externalSupervisorId')}
                disabled={viewOnly}
                placeholder="External supervisor email or ID"
              />
            </FormField>
          )}

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
              disabled={viewOnly}
            >
              <option value="">Select Department</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </FormSelect>
          </FormField>

          <FormField id="supervisorId" label="Supervisor">
            <FormSelect
              id="supervisorId"
              value={formData.supervisorId}
              onValueChange={handleChange('supervisorId')}
              onBlur={handleBlur('supervisorId')}
              disabled={viewOnly}
            >
              <option value="">Select Supervisor</option>
              {supervisors.map(sup => (
                <option key={sup.id} value={sup.id}>{sup.userName || sup.userEmail || sup.userId}</option>
              ))}
            </FormSelect>
          </FormField>

          <FormField
            id="scheduleId"
            label="Work Schedule"
            required
            error={touched.scheduleId ? errors.scheduleId : undefined}
          >
            <FormSelect
              id="scheduleId"
              value={formData.scheduleId}
              onValueChange={handleChange('scheduleId')}
              onBlur={handleBlur('scheduleId')}
              error={touched.scheduleId ? errors.scheduleId : undefined}
              disabled={viewOnly || !formData.companyId}
            >
              <option value="">Select Work Schedule</option>
              {workSchedules.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name} ({ws.timeIn} - {ws.timeOut})</option>
              ))}
            </FormSelect>
            {!formData.companyId && (
              <p className="text-xs text-[#9E9E9E] mt-1">Select a company first</p>
            )}
          </FormField>

          <FormField id="status" label="Account Status">
            <FormSelect
              id="status"
              value={formData.status}
              onValueChange={handleChange('status')}
              onBlur={handleBlur('status')}
              disabled={viewOnly}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </FormSelect>
          </FormField>

          <FormField id="ojtStatus" label="OJT Status">
            <FormSelect
              id="ojtStatus"
              value={formData.ojtStatus}
              onValueChange={handleChange('ojtStatus')}
              onBlur={handleBlur('ojtStatus')}
              disabled={viewOnly}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="completed">Completed</option>
              <option value="terminated">Terminated</option>
              <option value="archived">Archived</option>
            </FormSelect>
          </FormField>
        </div>

        <div className="border-t border-[#D5D5D5] dark:border-[#3A3A3A] pt-6">
          <h3 className="text-lg font-medium text-[#121212] dark:text-white mb-4">Student Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="studentId" label="Student ID">
              <FormInput
                type="text"
                id="studentId"
                value={formData.profile?.studentId || ''}
                onValueChange={handleChange('profile.studentId')}
                disabled={viewOnly}
                placeholder="e.g., 2024-00123"
              />
            </FormField>

            <FormField id="course" label="Course">
              <FormInput
                type="text"
                id="course"
                value={formData.profile?.course || ''}
                onValueChange={handleChange('profile.course')}
                disabled={viewOnly}
                placeholder="e.g., BS Computer Science"
              />
            </FormField>

            <FormField id="school" label="School">
              <FormInput
                type="text"
                id="school"
                value={formData.profile?.school || ''}
                onValueChange={handleChange('profile.school')}
                disabled={viewOnly}
                placeholder="e.g., University of the Philippines"
              />
            </FormField>

            <FormField id="yearLevel" label="Year Level">
              <FormInput
                type="text"
                id="yearLevel"
                value={formData.profile?.yearLevel || ''}
                onValueChange={handleChange('profile.yearLevel')}
                disabled={viewOnly}
                placeholder="e.g., 3rd Year"
              />
            </FormField>
          </div>
        </div>

        <div className="border-t border-[#D5D5D5] dark:border-[#3A3A3A] pt-6">
          <h3 className="text-lg font-medium text-[#121212] dark:text-white mb-4">Emergency Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField id="ecName" label="Name">
              <FormInput
                type="text"
                id="ecName"
                value={formData.profile?.emergencyContact?.name || ''}
                onValueChange={handleChange('emergencyContact.name')}
                disabled={viewOnly}
                placeholder="Contact name"
              />
            </FormField>

            <FormField id="ecRelationship" label="Relationship">
              <FormInput
                type="text"
                id="ecRelationship"
                value={formData.profile?.emergencyContact?.relationship || ''}
                onValueChange={handleChange('emergencyContact.relationship')}
                disabled={viewOnly}
                placeholder="e.g., Parent"
              />
            </FormField>

            <FormField id="ecPhone" label="Phone">
              <FormInput
                type="tel"
                id="ecPhone"
                value={formData.profile?.emergencyContact?.phone || ''}
                onValueChange={handleChange('emergencyContact.phone')}
                disabled={viewOnly}
                placeholder="+63 9XX XXX XXXX"
              />
            </FormField>
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
              {saving ? 'Saving...' : (isEditing ? 'Update' : 'Create Trainee')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
