import { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import type { TraineeFormData, Company, Department, Supervisor, Trainee, User } from '../types';

interface TraineeFormProps {
  editingId?: string;
  viewOnly?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
}

export function TraineeForm({ editingId, viewOnly, onCancel, onSaved }: TraineeFormProps) {
  const isEditing = !!editingId;

  const [formData, setFormData] = useState<TraineeFormData>({
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
  });

  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [supervisors, setSupervisors] = useState<(Supervisor & { userName?: string; userEmail?: string })[]>([]);
  const [existingUsers, setExistingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useExistingUser, setUseExistingUser] = useState(false);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

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
  }, [isEditing, editingId]);

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

  const handleChange = (field: string, value: string) => {
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
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (isEditing && editingId) {
        await adminService.updateTrainee(editingId, {
          companyId: formData.companyId,
          departmentId: formData.departmentId,
          supervisorId: formData.supervisorId,
          scheduleId: formData.scheduleId,
          status: formData.status,
          ojtStatus: formData.ojtStatus,
          profile: formData.profile,
        } as Partial<Trainee>);
      } else {
        let userId = formData.userId;

        if (useExistingUser) {
          if (!userId) throw new Error('Select a user');
        } else {
          if (!newUserEmail || !newUserDisplayName || !newUserPassword) {
            throw new Error('Email, display name, and password are required');
          }
          const user = await adminService.createUser({
            email: newUserEmail,
            displayName: newUserDisplayName,
            role: 'trainee',
            companyId: formData.companyId,
            departmentId: formData.departmentId,
            password: newUserPassword,
          });
          userId = user.id;
        }

        if (!formData.companyId || !formData.departmentId) {
          throw new Error('Company and department are required');
        }

        await adminService.createTrainee({
          ...formData,
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        {viewOnly ? 'View Trainee Profile' : isEditing ? 'Edit Trainee Profile' : 'Add Trainee'}
      </h2>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {!isEditing && (
          <div className="flex items-center gap-3 mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={useExistingUser}
                onChange={(e) => setUseExistingUser(e.target.checked)}
                disabled={viewOnly}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              Link to existing user account
            </label>
          </div>
        )}

        {!isEditing && (useExistingUser ? (
          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              User <span className="text-red-500">*</span>
            </label>
            <select
              id="userId"
              value={formData.userId}
              onChange={(e) => handleChange('userId', e.target.value)}
              required
              disabled={viewOnly}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select User</option>
              {existingUsers.map(user => (
                <option key={user.id} value={user.id}>{user.displayName} ({user.email})</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="newEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="newEmail"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                required
                disabled={viewOnly}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="trainee@example.com"
              />
            </div>
            <div>
              <label htmlFor="newDisplayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="newDisplayName"
                value={newUserDisplayName}
                onChange={(e) => setNewUserDisplayName(e.target.value)}
                required
                disabled={viewOnly}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Juan Dela Cruz"
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="newPassword"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                required
                minLength={6}
                disabled={viewOnly}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="At least 6 characters"
              />
            </div>
          </>
        ))}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="companyId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company <span className="text-red-500">*</span>
            </label>
            <select
              id="companyId"
              value={formData.companyId}
              onChange={(e) => handleChange('companyId', e.target.value)}
              required
              disabled={viewOnly}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select Company</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="placementType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Placement Type <span className="text-red-500">*</span>
            </label>
            <select
              id="placementType"
              value={formData.placementType}
              onChange={(e) => handleChange('placementType', e.target.value)}
              disabled={viewOnly}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="internal">Internal</option>
              <option value="external">External</option>
            </select>
          </div>

          {formData.placementType === 'external' && (
            <>
              <div>
                <label htmlFor="externalCompanyId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  External Company <span className="text-red-500">*</span>
                </label>
                <select
                  id="externalCompanyId"
                  value={formData.externalCompanyId}
                  onChange={(e) => handleChange('externalCompanyId', e.target.value)}
                  disabled={viewOnly}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select External Company</option>
                  {companies.filter(c => c.type === 'external' && c.verified).map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="externalSupervisorId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  External Supervisor ID
                </label>
                <input
                  type="text"
                  id="externalSupervisorId"
                  value={formData.externalSupervisorId}
                  onChange={(e) => handleChange('externalSupervisorId', e.target.value)}
                  disabled={viewOnly}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="External supervisor email or ID"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="departmentId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              id="departmentId"
              value={formData.departmentId}
              onChange={(e) => handleChange('departmentId', e.target.value)}
              required
              disabled={viewOnly}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select Department</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="supervisorId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Supervisor
            </label>
            <select
              id="supervisorId"
              value={formData.supervisorId}
              onChange={(e) => handleChange('supervisorId', e.target.value)}
              disabled={viewOnly}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select Supervisor</option>
              {supervisors.map(sup => (
                <option key={sup.id} value={sup.id}>{sup.userName || sup.userEmail || sup.userId}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Account Status
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              disabled={viewOnly}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label htmlFor="ojtStatus" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              OJT Status
            </label>
            <select
              id="ojtStatus"
              value={formData.ojtStatus}
              onChange={(e) => handleChange('ojtStatus', e.target.value)}
              disabled={viewOnly}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="completed">Completed</option>
              <option value="terminated">Terminated</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Student Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Student ID
              </label>
              <input
                type="text"
                id="studentId"
                value={formData.profile?.studentId || ''}
                onChange={(e) => handleChange('profile.studentId', e.target.value)}
                disabled={viewOnly}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 2024-00123"
              />
            </div>

            <div>
              <label htmlFor="course" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Course
              </label>
              <input
                type="text"
                id="course"
                value={formData.profile?.course || ''}
                onChange={(e) => handleChange('profile.course', e.target.value)}
                disabled={viewOnly}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., BS Computer Science"
              />
            </div>

            <div>
              <label htmlFor="school" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                School
              </label>
              <input
                type="text"
                id="school"
                value={formData.profile?.school || ''}
                onChange={(e) => handleChange('profile.school', e.target.value)}
                disabled={viewOnly}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., University of the Philippines"
              />
            </div>

            <div>
              <label htmlFor="yearLevel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Year Level
              </label>
              <input
                type="text"
                id="yearLevel"
                value={formData.profile?.yearLevel || ''}
                onChange={(e) => handleChange('profile.yearLevel', e.target.value)}
                disabled={viewOnly}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 3rd Year"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Emergency Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="ecName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                id="ecName"
                value={formData.profile?.emergencyContact?.name || ''}
                onChange={(e) => handleChange('emergencyContact.name', e.target.value)}
                disabled={viewOnly}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Contact name"
              />
            </div>

            <div>
              <label htmlFor="ecRelationship" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Relationship
              </label>
              <input
                type="text"
                id="ecRelationship"
                value={formData.profile?.emergencyContact?.relationship || ''}
                onChange={(e) => handleChange('emergencyContact.relationship', e.target.value)}
                disabled={viewOnly}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Parent"
              />
            </div>

            <div>
              <label htmlFor="ecPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone
              </label>
              <input
                type="tel"
                id="ecPhone"
                value={formData.profile?.emergencyContact?.phone || ''}
                onChange={(e) => handleChange('emergencyContact.phone', e.target.value)}
                disabled={viewOnly}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+63 9XX XXX XXXX"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
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
