import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../services/adminService';
import type { OJTScheduleFormData, WorkSchedule } from '../types';

export function OJTScheduleForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [formData, setFormData] = useState<OJTScheduleFormData>({
    companyId: '',
    name: '',
    startDate: new Date(),
    endDate: new Date(),
    requiredHours: 480,
    workScheduleId: '',
    description: '',
  });

  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkSchedules = async () => {
    try {
      const result = await adminService.listWorkSchedules({ limit: 100 });
      setWorkSchedules(result.data);
    } catch (err) {
      console.error('Failed to load work schedules:', err);
    }
  };

  const loadSchedule = async (scheduleId: string) => {
    try {
      const schedule = await adminService.getOJTSchedule(scheduleId);
      setFormData({
        companyId: schedule.companyId,
        name: schedule.name,
        startDate: new Date(schedule.startDate.seconds * 1000),
        endDate: new Date(schedule.endDate.seconds * 1000),
        requiredHours: schedule.requiredHours,
        workScheduleId: schedule.workScheduleId,
        description: schedule.description || '',
      });
    } catch (err) {
      setError('Failed to load schedule');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkSchedules();
    if (isEditing) {
      loadSchedule(id!);
    } else {
      setLoading(false);
    }
  }, [id, isEditing]);

  const handleChange = (field: keyof OJTScheduleFormData, value: string | number | Date) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const submitData = {
        ...formData,
        startDate: formData.startDate instanceof Date ? formData.startDate : new Date(formData.startDate),
        endDate: formData.endDate instanceof Date ? formData.endDate : new Date(formData.endDate),
      };

      if (isEditing) {
        await adminService.updateOJTSchedule(id!, submitData);
      } else {
        await adminService.createOJTSchedule(submitData);
      }
      navigate('/admin/ojt-schedules');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save schedule';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin/ojt-schedules');
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
        {isEditing ? 'Edit OJT Schedule' : 'Create OJT Schedule'}
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="companyId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Company <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="companyId"
            value={formData.companyId}
            onChange={(e) => handleChange('companyId', e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Company ID"
          />
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Schedule Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="OJT Schedule Name"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="startDate"
              value={formData.startDate instanceof Date ? formData.startDate.toISOString().split('T')[0] : ''}
              onChange={(e) => handleChange('startDate', new Date(e.target.value))}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="endDate"
              value={formData.endDate instanceof Date ? formData.endDate.toISOString().split('T')[0] : ''}
              onChange={(e) => handleChange('endDate', new Date(e.target.value))}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="requiredHours" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Required Hours <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="requiredHours"
              value={formData.requiredHours}
              onChange={(e) => handleChange('requiredHours', parseInt(e.target.value) || 0)}
              required
              min="1"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="480"
            />
          </div>

          <div>
            <label htmlFor="workScheduleId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Work Schedule <span className="text-red-500">*</span>
            </label>
            <select
              id="workScheduleId"
              value={formData.workScheduleId}
              onChange={(e) => handleChange('workScheduleId', e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Work Schedule</option>
              {workSchedules.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name} ({ws.timeIn} - {ws.timeOut})</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Schedule description"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
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