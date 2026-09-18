import { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import type { User, Company, Department } from '../types';

interface CoordinatorFormProps {
  editingId?: string;
  editingCoordinatorId?: string;
  onCancel?: () => void;
  onSaved?: () => void;
}

export function CoordinatorForm({ editingId, editingCoordinatorId, onCancel, onSaved }: CoordinatorFormProps) {
  const isEditing = !!editingCoordinatorId;

  const [formData, setFormData] = useState({
    userId: '',
    companyId: '',
    departmentId: '',
    email: '',
    displayName: '',
    password: '',
  });

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
          setFormData(prev => ({
            ...prev,
            userId: coordinator.userId,
            companyId: coordinator.companyId,
            departmentId: coordinator.departmentId,
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
  }, [isEditing, editingCoordinatorId, editingId]);

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
          const result = await adminService.listUsers({ role: 'coordinator', companyId: formData.companyId, limit: 100 });
          setExistingUsers(result.data);
        } catch (err) {
          console.error('Failed to load users:', err);
        }
      };
      loadUsers();
    }
  }, [useExistingUser, formData.companyId]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (isEditing && editingCoordinatorId) {
        await adminService.updateCoordinator(editingCoordinatorId, {
          companyId: formData.companyId,
          departmentId: formData.departmentId,
        });
        if (editingId) {
          await adminService.updateUser(editingId, {
            companyId: formData.companyId,
            departmentId: formData.departmentId,
          });
        }
      } else if (useExistingUser) {
        if (!formData.userId) throw new Error('Select a user');
        await adminService.createCoordinator({
          userId: formData.userId,
          companyId: formData.companyId,
          departmentId: formData.departmentId,
        });
      } else {
        if (!formData.email || !formData.displayName || !formData.password) {
          throw new Error('Email, display name, and password are required');
        }
        const user = await adminService.createUser({
          email: formData.email,
          displayName: formData.displayName,
          role: 'coordinator',
          companyId: formData.companyId,
          departmentId: formData.departmentId,
          password: formData.password,
        });
        await adminService.createCoordinator({
          userId: user.id,
          companyId: formData.companyId,
          departmentId: formData.departmentId,
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {isEditing && formData.displayName && (
          <div className="p-3 bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 rounded-lg border border-[#D5D5D5] dark:border-[#555555]">
            <p className="text-sm font-medium text-[#121212] dark:text-white">{formData.displayName}</p>
            <p className="text-xs text-[#757575] dark:text-[#9E9E9E]">{formData.email}</p>
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
          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              User <span className="text-red-500">*</span>
            </label>
            <select
              id="userId"
              value={formData.userId}
              onChange={(e) => handleChange('userId', e.target.value)}
              required
              className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label htmlFor="email" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="coordinator@example.com"
              />
            </div>
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="displayName"
                value={formData.displayName}
                onChange={(e) => handleChange('displayName', e.target.value)}
                required
                className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Juan Dela Cruz"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="At least 6 characters"
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="companyId" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
            Company <span className="text-red-500">*</span>
          </label>
          <select
            id="companyId"
            value={formData.companyId}
            onChange={(e) => handleChange('companyId', e.target.value)}
            required
            className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Company</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="departmentId" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
            Department <span className="text-red-500">*</span>
          </label>
          <select
            id="departmentId"
            value={formData.departmentId}
            onChange={(e) => handleChange('departmentId', e.target.value)}
            required
            className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Department</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>

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
