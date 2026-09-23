import { useState, useEffect, useCallback, useRef } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { EmptyState, CalendarIcon } from '@/shared/components/EmptyState';
import { Skeleton } from '@/shared/components/Skeleton';
import { Button } from '@/shared/components/ui/Button';
import { Search } from 'lucide-react';
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
  const totalPages = Math.max(1, Math.ceil(total / (filters.limit || 10)));
  const [searchValue, setSearchValue] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setFilters((p) => ({ ...p, search, page: 1 }));
    }, 350);
  };

  const handlePageChange = (page: number) => {
    setFilters((p) => ({ ...p, page }));
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const handleDelete = (schedule: WorkSchedule) => {
    setConfirmDialog({
      title: 'Delete Work Schedule',
      message: `Are you sure you want to delete schedule "${schedule.name}"?`,
      danger: true,
      onConfirm: async () => {
        onDelete?.(schedule);
      },
    });
  };

  const formatWorkDays = (days: number[] | undefined) => {
    if (!Array.isArray(days) || days.length === 0) return '—';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map((d) => dayNames[d] ?? d).join(', ');
  };

  const to12Hour = (time24: string | undefined) => {
    if (!time24 || typeof time24 !== 'string' || !time24.includes(':')) return '—';
    const [h, m] = time24.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '—';
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <>
      <div className="space-y-4">
        {/* Search & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border border-border rounded-lg p-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search schedules..."
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <span className="text-xs text-muted-foreground self-center sm:self-auto">
            {total} {total === 1 ? 'schedule' : 'schedules'} configured
          </span>
        </div>

        {error && (
          <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="space-y-1.5 flex-1">
                  <Skeleton variant="text" width="35%" height={16} />
                  <Skeleton variant="text" width="20%" height={12} />
                </div>
                <Skeleton variant="text" width={70} height={24} />
              </div>
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <div className="bg-card border border-border rounded-lg">
            <EmptyState
              icon={CalendarIcon}
              title="No work schedules found"
              description={searchValue ? 'No work schedules matched your search criteria.' : 'Create regular shift and work schedules.'}
            />
          </div>
        ) : (
          <>
            {/* Mobile Card Layout (< md) */}
            <div className="space-y-3 md:hidden">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onView?.(schedule)}
                        className="font-semibold text-sm text-foreground hover:text-primary transition-colors truncate block text-left"
                      >
                        {schedule.name}
                      </button>
                      <p className="text-xs text-muted-foreground truncate">{schedule.companyName || 'No company assigned'}</p>
                    </div>
                    <ActionsMenu
                      items={[
                        ...(onView ? [{ label: 'View', onClick: () => onView(schedule) }] : []),
                        ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(schedule) }] : []),
                        ...(onDelete ? [{ label: 'Delete', onClick: () => handleDelete(schedule), danger: true }] : []),
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Hours</span>
                      <span className="text-foreground font-medium">
                        {to12Hour(schedule.timeIn)} – {to12Hour(schedule.timeOut)}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Break</span>
                      <span className="text-foreground">{schedule.breakDurationMinutes ? `${schedule.breakDurationMinutes} mins` : '—'}</span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-muted-foreground block">Work Days</span>
                      <span className="text-foreground">{formatWorkDays(schedule.workDays)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Layout (>= md) */}
            <div className="hidden md:block bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Schedule Name
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Company
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Shift Hours
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Break (min)
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Work Days
                    </th>
                    <th className="h-[44px] px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {schedules.map((schedule) => (
                    <tr key={schedule.id} className="h-[44px] hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => onView?.(schedule)}
                          className="font-medium text-foreground hover:text-primary transition-colors text-left"
                        >
                          {schedule.name}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {schedule.companyName || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-foreground">
                        {to12Hour(schedule.timeIn)} – {to12Hour(schedule.timeOut)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {schedule.breakDurationMinutes ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {formatWorkDays(schedule.workDays)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ActionsMenu
                          items={[
                            ...(onView ? [{ label: 'View', onClick: () => onView(schedule) }] : []),
                            ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(schedule) }] : []),
                            ...(onDelete ? [{ label: 'Delete', onClick: () => handleDelete(schedule), danger: true }] : []),
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 bg-card border border-border rounded-lg flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {filters.page || 1} of {totalPages} ({total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange((filters.page || 1) - 1)}
                    disabled={(filters.page || 1) <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange((filters.page || 1) + 1)}
                    disabled={(filters.page || 1) >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        danger={confirmDialog?.danger}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
        onCancel={() => setConfirmDialog(null)}
      />
    </>
  );
}