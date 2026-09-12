import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../services/adminService';
import type { WorkScheduleFormData } from '../types';

const DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function WorkScheduleForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [formData, setFormData] = useState<WorkScheduleFormData>({
    companyId: '',
    name: '',
    timeIn: '08:00',
    timeOut: '17:00',
    breakDurationMinutes: 60,
    workDays: [1, 2, 3, 4, 5],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSchedule = async (scheduleId: string) => {
    try {
      const schedule = await adminService.getWorkSchedule(scheduleId);
      setFormData({
        companyId: schedule.companyId,
        name: schedule.name,
        timeIn: schedule.timeIn,
        timeOut: schedule.timeOut,
        breakDurationMinutes: schedule.breakDurationMinutes,
        workDays: schedule.workDays,
      });
    } catch (err) {
      setError('Failed to load schedule');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isEditing) {
      loadSchedule(id!);
    } else {
      setLoading(false);
    }
  }, [id, isEditing]);

  const handleChange = (field: keyof WorkScheduleFormData, value: string | number | number[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleWorkDayToggle = (day: number) => {
    setFormData(prev => {
      const newWorkDays = prev.workDays.includes(day)
        ? prev.workDays.filter(d => d !== day)
        : [...prev.workDays, day].sort((a, b) => a - b);
      return { ...prev, workDays: newWorkDays };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (isEditing) {
        await adminService.updateWorkSchedule(id!, formData);
      } else {
        await adminService.createWorkSchedule(formData);
      }
      navigate('/admin/work-schedules');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save schedule';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin/work-schedules');
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
        {isEditing ? 'Edit Work Schedule' : 'Create Work Schedule'}
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
            placeholder="Work Schedule Name"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="timeIn" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time In <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              id="timeIn"
              value={formData.timeIn}
              onChange={(e) => handleChange('timeIn', e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="timeOut" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time Out <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              id="timeOut"
              value={formData.timeOut}
              onChange={(e) => handleChange('timeOut', e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="breakDurationMinutes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Break Duration (min) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="breakDurationMinutes"
              value={formData.breakDurationMinutes}
              onChange={(e) => handleChange('breakDurationMinutes', parseInt(e.target.value) || 0)}
              required
              min="0"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="60"
            />
          </div>
        </div>

        <div>
          <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Work Days <span className="text-red-500">*</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {DAY_OPTIONS.map(day => (
              <label
                key={day.value}
                className={`inline-flex items-center px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                  formData.workDays.includes(day.value)
                    ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  value={day.value}
                  checked={formData.workDays.includes(day.value)}
                  onChange={() => handleWorkDayToggle(day.value)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="ml-2 text-sm">{day.label}</span>
              </label>
            ))}
          </div>
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