import { useState, useEffect, useCallback, useRef } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { EmptyState, CalendarIcon } from '@/shared/components/EmptyState';
import { Skeleton } from '@/shared/components/Skeleton';
import { Button } from '@/shared/components/ui/Button';
import { useAuth } from '@/features/auth';
import { Search } from 'lucide-react';
import type { OJTSchedule, ListOJTSchedulesParams } from '../types';

interface OJTScheduleListProps {
  onEdit?: (schedule: OJTSchedule) => void;
  onView?: (schedule: OJTSchedule) => void;
  onDelete?: (schedule: OJTSchedule) => void;
}

interface ResolvedOJTSchedule extends OJTSchedule {
  companyName?: string;
  workScheduleName?: string;
}

export function OJTScheduleList({ onEdit, onView, onDelete }: OJTScheduleListProps) {
  const { role } = useAuth();
  const [schedules, setSchedules] = useState<ResolvedOJTSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ListOJTSchedulesParams>({ page: 1, limit: 10 });
  const [total, setTotal] = useState(0);
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
      const params: ListOJTSchedulesParams = { ...filters };
      const result = await adminService.listOJTSchedules(params);
      const resolved = await Promise.all(
        result.data.map(async (s) => {
          const [companyName, workScheduleName] = await Promise.all([
            resolveDocName('companies', s.companyId, 'name'),
            s.workScheduleId ? resolveDocName('work_schedules', s.workScheduleId, 'name') : Promise.resolve(''),
          ]);
          return { ...s, companyName, workScheduleName };
        }),
      );
      setSchedules(resolved);
      setTotal(result.total);
    } catch (err) {
      setError('Failed to load OJT schedules');
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

  const handleDelete = (schedule: OJTSchedule) => {
    setConfirmDialog({
      title: 'Delete OJT Schedule',
      message: `Are you sure you want to delete OJT schedule "${schedule.name}"?`,
      danger: true,
      onConfirm: async () => {
        try {
          await adminService.deleteOJTSchedule(schedule.id);
          onDelete?.(schedule);
          fetchSchedules();
        } catch (err) {
          console.error('Failed to delete schedule:', err);
          setError('Failed to delete schedule');
        }
      },
    });
  };

  const totalPages = Math.ceil(total / (filters.limit || 10));

  const formatDate = (timestamp: { seconds: number; nanoseconds: number } | Date | string | undefined) => {
    if (!timestamp) return '—';
    if (timestamp instanceof Date) return timestamp.toLocaleDateString();
    if (typeof timestamp === 'string') {
      const d = new Date(timestamp);
      return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
    }
    if (typeof timestamp === 'object' && 'seconds' in timestamp) {
      return new Date(timestamp.seconds * 1000).toLocaleDateString();
    }
    return '—';
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
            {total} {total === 1 ? 'schedule' : 'schedules'} active
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
              title="No OJT schedules found"
              description={searchValue ? 'No OJT schedules matched your search criteria.' : 'Create standard OJT duration and hour requirements.'}
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
                      <p className="text-xs text-muted-foreground truncate">{schedule.companyName || 'No company specified'}</p>
                    </div>
                    <ActionsMenu
                      items={[
                        ...(onView ? [{ label: 'View', onClick: () => onView(schedule) }] : []),
                        ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(schedule) }] : []),
                        ...(role === 'admin' ? [{ label: 'Delete', onClick: () => handleDelete(schedule), danger: true }] : []),
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Required Hours</span>
                      <span className="text-foreground font-semibold">{schedule.requiredHours} hrs</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Work Schedule</span>
                      <span className="text-foreground truncate block">{schedule.workScheduleName || '—'}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Start Date</span>
                      <span className="text-muted-foreground">{formatDate(schedule.startDate)}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">End Date</span>
                      <span className="text-muted-foreground">{formatDate(schedule.endDate)}</span>
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
                      Start Date
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      End Date
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Required Hours
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Work Schedule
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
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {formatDate(schedule.startDate)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {formatDate(schedule.endDate)}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-foreground">
                        {schedule.requiredHours} hrs
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {schedule.workScheduleName || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ActionsMenu
                          items={[
                            ...(onView ? [{ label: 'View', onClick: () => onView(schedule) }] : []),
                            ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(schedule) }] : []),
                            ...(role === 'admin' ? [{ label: 'Delete', onClick: () => handleDelete(schedule), danger: true }] : []),
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