import { useState, useEffect, useCallback, useRef } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import type { WorkSchedule, ListWorkSchedulesParams } from '../types';

interface WorkScheduleListProps {
  onEdit?: (schedule: WorkSchedule) => void;
  onView?: (schedule: WorkSchedule) => void;
  onDelete?: (schedule: WorkSchedule) => void;
}

interface ResolvedWorkSchedule extends WorkSchedule {
  companyName?: string;
}

export function WorkScheduleList({ onEdit, onView, onDelete }: WorkScheduleListProps) {
  const [schedules, setSchedules] = useState<ResolvedWorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ListWorkSchedulesParams>({ page: 1, limit: 10 });
  const [total, setTotal] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminService.listWorkSchedules(filters);
      const resolved = await Promise.all(
        result.data.map(async (s) => {
          const companyName = await resolveDocName('companies', s.companyId, 'name');
          return { ...s, companyName };
        }),
      );
      setSchedules(resolved);
      setTotal(result.total);
    } catch (err) {
      setError('Failed to load work schedules');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleSearch = (search: string) => {
    setSearchValue(search);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setFilters(p => ({ ...p, search, page: 1 }));
    }, 400);
  };

  const handlePageChange = (page: number) => {
    setFilters(p => ({ ...p, page }));
  };

  const totalPages = Math.ceil(total / (filters.limit || 10));

  const formatWorkDays = (days: number[] | undefined) => {
    if (!Array.isArray(days) || days.length === 0) return '—';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(d => dayNames[d] ?? d).join(', ');
  };

  const to12Hour = (time24: string | undefined) => {
    if (!time24 || typeof time24 !== 'string' || !time24.includes(':')) return '—';
    const [h, m] = time24.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '—';
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  };

  if (loading && schedules.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
        <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-[#121212] dark:text-white">Work Schedules</h2>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search schedules..."
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full sm:w-64 px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
      <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-[#121212] dark:text-white">Work Schedules</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search schedules..."
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full sm:w-64 px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && schedules.length > 0 && (
        <div className="h-0.5 w-full overflow-hidden bg-[#EFEFEF] dark:bg-[#3A3A3A]">
          <div className="h-full bg-blue-600 animate-pulse" style={{ width: '40%' }} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#F5F5F5] dark:bg-[#3A3A3A]/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Company</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Time In</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Time Out</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Break (min)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Work Days</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D5D5D5] dark:divide-[#3A3A3A]">
            {schedules.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#757575] dark:text-[#9E9E9E]">
                  No work schedules found
                </td>
              </tr>
            ) : (
              schedules.map(schedule => (
                <tr key={schedule.id} className="hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/50">
                  <td className="px-4 py-4 text-sm text-[#121212] dark:text-white font-medium">
                    {schedule.name}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {schedule.companyName || '—'}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {to12Hour(schedule.timeIn)}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {to12Hour(schedule.timeOut)}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {schedule.breakDurationMinutes ?? '—'}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {formatWorkDays(schedule.workDays)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <ActionsMenu
                      items={[
                        ...(onView ? [{ label: 'View', onClick: () => onView(schedule) }] : []),
                        ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(schedule) }] : []),
                        ...(onDelete ? [{ label: 'Delete', onClick: () => onDelete(schedule), danger: true }] : []),
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-[#D5D5D5] dark:border-[#3A3A3A] flex items-center justify-between">
          <div className="text-sm text-[#757575] dark:text-[#9E9E9E]">
            Page {filters.page} of {totalPages} ({total} total)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange((filters.page || 1) - 1)}
              disabled={(filters.page || 1) <= 1}
              className="px-3 py-1 text-sm border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange((filters.page || 1) + 1)}
              disabled={(filters.page || 1) >= totalPages}
              className="px-3 py-1 text-sm border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}