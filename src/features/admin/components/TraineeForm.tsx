import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required } from '@/shared/utils/validators';
import { FormField, FormInput, FormSelect, FormTextarea } from '@/shared/components/FormField';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import type { TraineeFormData, Company, Department, Supervisor, Trainee, User, WorkSchedule } from '../types';

interface TraineeFormProps {
  editingId?: string;
  viewOnly?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
}

const STEPS = [
  { id: 1, title: 'Personal Info', description: 'Account & Education' },
  { id: 2, title: 'OJT Details', description: 'Placement & Schedule' },
  { id: 3, title: 'Contact & Notes', description: 'Emergency & Remarks' },
];

export function TraineeForm({ editingId, viewOnly, onCancel, onSaved }: TraineeFormProps) {
  const isEditing = !!editingId;
  const [currentStep, setCurrentStep] = useState(1);

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
      setFormData((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          [profileField]: value,
        } as TraineeFormData['profile'],
      }));
    } else if (field.startsWith('emergencyContact.')) {
      const ecField = field.slice(17) as 'name' | 'relationship' | 'phone';
      setFormData((prev) => ({
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
      const selectedCompany = companies.find((c) => c.id === value);
      const isExternal = selectedCompany?.type === 'external';
      setFormData((prev) => ({
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

  const validateStep = (step: number): boolean => {
    setError(null);
    if (step === 1 && !isEditing) {
      if (useExistingUser) {
        if (!formData.userId) {
          setError('Please select an existing user');
          return false;
        }
      } else {
        if (!newUserEmail || !newUserDisplayName || !newUserPassword) {
          setNewUserEmailTouched(true);
          setNewUserDisplayNameTouched(true);
          setNewUserPasswordTouched(true);
          setError('Email, display name, and password are required');
          return false;
        }
        if (newUserPassword.length < 6) {
          setNewUserPasswordTouched(true);
          setError('Password must be at least 6 characters');
          return false;
        }
      }
    } else if (step === 2) {
      if (!formData.companyId) {
        setError('Company is required');
        return false;
      }
      if (!formData.departmentId) {
        setError('Department is required');
        return false;
      }
      if (!formData.scheduleId) {
        setError('Work schedule is required');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

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
          placementNotes: data.placementNotes,
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

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton variant="text" width="50%" height={24} />
        <div className="grid grid-cols-3 gap-2 py-2">
          <Skeleton variant="rectangular" height={36} />
          <Skeleton variant="rectangular" height={36} />
          <Skeleton variant="rectangular" height={36} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <Skeleton variant="rectangular" height={40} className="sm:col-span-2" />
          <Skeleton variant="rectangular" height={40} />
          <Skeleton variant="rectangular" height={40} />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Wizard Step Indicator */}
      <div className="flex items-center justify-between gap-2 px-2 py-3 bg-muted/30 rounded-xl border border-border">
        {STEPS.map((step, idx) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          return (
            <div key={step.id} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    isCompleted
                      ? 'bg-success text-success-foreground'
                      : isActive
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.id}
                </div>
                <div className="hidden sm:block text-left">
                  <p className={`text-xs font-medium leading-none ${isActive ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                    {step.title}
                  </p>
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 transition-colors ${
                    currentStep > step.id ? 'bg-success' : 'bg-border'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Personal & Student Info */}
      {currentStep === 1 && (
        <div className="space-y-4">
          {!isEditing && (
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border border-border">
              <input
                type="checkbox"
                id="useExistingUserTrainee"
                checked={useExistingUser}
                onChange={(e) => setUseExistingUser(e.target.checked)}
                disabled={viewOnly}
                className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
              />
              <label htmlFor="useExistingUserTrainee" className="text-sm font-medium text-foreground cursor-pointer">
                Link to existing user account
              </label>
            </div>
          )}

          {!isEditing && useExistingUser ? (
            <FormField id="userId" label="User Account" required error={touched.userId ? errors.userId : undefined}>
              <FormSelect
                id="userId"
                value={formData.userId}
                onValueChange={handleChange('userId')}
                onBlur={handleBlur('userId')}
                error={touched.userId ? errors.userId : undefined}
                disabled={viewOnly}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                id="newEmail"
                label="Email"
                required
                error={newUserEmailTouched && !newUserEmail ? 'Email is required' : undefined}
                className="sm:col-span-2"
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
                label="Full Name"
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
                error={
                  newUserPasswordTouched && !newUserPassword
                    ? 'Password is required'
                    : newUserPasswordTouched && newUserPassword.length < 6
                    ? 'Password must be 6+ characters'
                    : undefined
                }
              >
                <FormInput
                  type="password"
                  id="newPassword"
                  value={newUserPassword}
                  onValueChange={setNewUserPassword}
                  onBlur={() => setNewUserPasswordTouched(true)}
                  error={
                    newUserPasswordTouched && !newUserPassword
                      ? 'Password is required'
                      : newUserPasswordTouched && newUserPassword.length < 6
                      ? 'Password must be 6+ characters'
                      : undefined
                  }
                  disabled={viewOnly}
                  placeholder="Minimum 6 characters"
                />
              </FormField>
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <h4 className="text-sm font-semibold text-foreground mb-3">Academic Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="studentId" label="Student ID">
                <FormInput
                  type="text"
                  id="studentId"
                  value={formData.profile?.studentId || ''}
                  onValueChange={handleChange('profile.studentId')}
                  disabled={viewOnly}
                  placeholder="e.g. 2024-00123"
                />
              </FormField>

              <FormField id="yearLevel" label="Year Level">
                <FormInput
                  type="text"
                  id="yearLevel"
                  value={formData.profile?.yearLevel || ''}
                  onValueChange={handleChange('profile.yearLevel')}
                  disabled={viewOnly}
                  placeholder="e.g. 3rd Year, 4th Year"
                />
              </FormField>

              <FormField id="school" label="School / University">
                <FormInput
                  type="text"
                  id="school"
                  value={formData.profile?.school || ''}
                  onValueChange={handleChange('profile.school')}
                  disabled={viewOnly}
                  placeholder="e.g. Polytechnic University of the Philippines"
                />
              </FormField>

              <FormField id="course" label="Degree / Program">
                <FormInput
                  type="text"
                  id="course"
                  value={formData.profile?.course || ''}
                  onValueChange={handleChange('profile.course')}
                  disabled={viewOnly}
                  placeholder="e.g. BS Information Technology"
                />
              </FormField>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: OJT Placement & Schedule */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="companyId" label="Company" required error={touched.companyId ? errors.companyId : undefined}>
              <FormSelect
                id="companyId"
                value={formData.companyId}
                onValueChange={handleChange('companyId')}
                onBlur={handleBlur('companyId')}
                error={touched.companyId ? errors.companyId : undefined}
                disabled={viewOnly}
              >
                <option value="">Select Company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} ({company.type === 'external' ? 'External' : 'Internal'})
                  </option>
                ))}
              </FormSelect>
            </FormField>

            <FormField id="placementType" label="Placement Type">
              <div className="min-h-10 px-3 border border-border rounded-lg bg-muted/40 flex items-center">
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${
                    formData.placementType === 'external'
                      ? 'bg-accent/15 text-accent'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  {formData.placementType === 'external' ? 'External Placement' : 'Internal Placement'}
                </span>
              </div>
            </FormField>

            {formData.placementType === 'external' && (
              <FormField id="externalSupervisorId" label="External Supervisor Contact" className="sm:col-span-2">
                <FormInput
                  type="text"
                  id="externalSupervisorId"
                  value={formData.externalSupervisorId}
                  onValueChange={handleChange('externalSupervisorId')}
                  disabled={viewOnly}
                  placeholder="Supervisor name, email, or contact number"
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
                disabled={viewOnly || !formData.companyId}
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </FormSelect>
            </FormField>

            <FormField id="supervisorId" label="Assigned Supervisor">
              <FormSelect
                id="supervisorId"
                value={formData.supervisorId}
                onValueChange={handleChange('supervisorId')}
                onBlur={handleBlur('supervisorId')}
                disabled={viewOnly || !formData.companyId}
              >
                <option value="">Select Supervisor (Optional)</option>
                {supervisors.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.userName || sup.userEmail || sup.userId}
                  </option>
                ))}
              </FormSelect>
            </FormField>

            <FormField
              id="scheduleId"
              label="Work Schedule"
              required
              error={touched.scheduleId ? errors.scheduleId : undefined}
              className="sm:col-span-2"
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
                {workSchedules.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name} ({ws.timeIn} - {ws.timeOut})
                  </option>
                ))}
              </FormSelect>
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
        </div>
      )}

      {/* Step 3: Emergency Contact & Placement Notes */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Emergency Contact</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField id="ecName" label="Contact Name">
                <FormInput
                  type="text"
                  id="ecName"
                  value={formData.profile?.emergencyContact?.name || ''}
                  onValueChange={handleChange('emergencyContact.name')}
                  disabled={viewOnly}
                  placeholder="Full Name"
                />
              </FormField>

              <FormField id="ecRelationship" label="Relationship">
                <FormInput
                  type="text"
                  id="ecRelationship"
                  value={formData.profile?.emergencyContact?.relationship || ''}
                  onValueChange={handleChange('emergencyContact.relationship')}
                  disabled={viewOnly}
                  placeholder="e.g. Parent, Guardian"
                />
              </FormField>

              <FormField id="ecPhone" label="Contact Phone">
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

          <div className="pt-2 border-t border-border">
            <FormField id="placementNotes" label="Placement Notes / Remarks">
              <FormTextarea
                id="placementNotes"
                value={formData.placementNotes || ''}
                onValueChange={handleChange('placementNotes')}
                disabled={viewOnly}
                rows={3}
                placeholder="Special notes regarding this trainee's placement or requirements"
              />
            </FormField>
          </div>
        </div>
      )}

      {/* Form Action Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div>
          {currentStep > 1 ? (
            <Button variant="secondary" type="button" onClick={handleBack}>
              Back
            </Button>
          ) : (
            <Button variant="secondary" type="button" onClick={onCancel}>
              {viewOnly ? 'Close' : 'Cancel'}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentStep < 3 ? (
            <Button variant="primary" type="button" onClick={handleNext}>
              Next
            </Button>
          ) : !viewOnly ? (
            <Button variant="primary" type="submit" isLoading={saving}>
              Save
            </Button>
          ) : (
            <Button variant="primary" type="button" onClick={onCancel}>
              Done
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
