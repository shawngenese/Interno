import { useState, useEffect, useCallback, useRef } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { EmptyState, InboxIcon } from '@/shared/components/EmptyState';
import { Skeleton } from '@/shared/components/Skeleton';
import { Button } from '@/shared/components/ui/Button';
import { Search } from 'lucide-react';
import type { Trainee, ListTraineesParams } from '../types';

interface TraineeListProps {
  onEdit?: (trainee: Trainee) => void;
  onView?: (trainee: Trainee) => void;
  onViewDocuments?: (trainee: Trainee) => void;
  onStatusChange?: (trainee: Trainee) => void;
}

interface ResolvedTrainee extends Trainee {
  userName?: string;
  companyName?: string;
  departmentName?: string;
  supervisorName?: string;
  requiredHours?: number;
  completedHours?: number;
}

const ojtStatusBadgeClasses: Record<string, string> = {
  active: 'bg-success/15 text-success',
  pending: 'bg-warning/15 text-warning',
  on_leave: 'bg-primary/15 text-primary',
  completed: 'bg-accent/15 text-accent',
  terminated: 'bg-destructive/15 text-destructive',
  archived: 'bg-muted text-muted-foreground',
};

export function TraineeList({ onEdit, onView, onViewDocuments, onStatusChange }: TraineeListProps) {
  const [trainees, setTrainees] = useState<ResolvedTrainee[]>([]);
  const traineesRef = useRef(trainees);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ListTraineesParams>({ page: 1, limit: 10 });
  const [total, setTotal] = useState(0);
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    traineesRef.current = trainees;
  }, [trainees]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!statusDropdownId) return;
    const handleClickOutside = () => setStatusDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [statusDropdownId]);

  const fetchTrainees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminService.listTrainees(filters);
      const db = getFirestoreInstancePublic();

      const userIds = new Set<string>();
      const companyIds = new Set<string>();
      const departmentIds = new Set<string>();
      const supervisorUserIds = new Map<string, string>();

      for (const t of result.data) {
        if (t.userId) userIds.add(t.userId);
        if (t.companyId) companyIds.add(t.companyId);
        if (t.departmentId) departmentIds.add(t.departmentId);
      }

      const supervisorIds = result.data
        .filter((t) => t.supervisorId)
        .map((t) => t.supervisorId!);

      const supDocs = await Promise.all(
        supervisorIds.map(async (supId) => {
          const supDoc = await getDoc(doc(db, 'supervisors', supId));
          if (supDoc.exists()) {
            const supUserId = (supDoc.data() as Record<string, unknown>).userId as string;
            return { supId, supUserId };
          }
          return { supId, supUserId: '' };
        }),
      );

      for (const { supId, supUserId } of supDocs) {
        if (supUserId) {
          supervisorUserIds.set(supId, supUserId);
          userIds.add(supUserId);
        }
      }

      const [userNames, companyNames, departmentNames, supervisorNames] = await Promise.all([
        Promise.all(
          Array.from(userIds).map(async (id) => {
            const name = await resolveDocName('users', id, 'displayName');
            return { id, name };
          }),
        ),
        Promise.all(
          Array.from(companyIds).map(async (id) => {
            const name = await resolveDocName('companies', id, 'name');
            return { id, name };
          }),
        ),
        Promise.all(
          Array.from(departmentIds).map(async (id) => {
            const name = await resolveDocName('departments', id, 'name');
            return { id, name };
          }),
        ),
        Promise.all(
          Array.from(supervisorUserIds.entries()).map(async ([supId, userId]) => {
            const name = await resolveDocName('users', userId, 'displayName');
            return { supId, name };
          }),
        ),
      ]);

      const userNameMap = new Map(userNames.map((u) => [u.id, u.name]));
      const companyNameMap = new Map(companyNames.map((c) => [c.id, c.name]));
      const departmentNameMap = new Map(departmentNames.map((d) => [d.id, d.name]));
      const supervisorNameMap = new Map(supervisorNames.map((s) => [s.supId, s.name]));

      const resolved = result.data.map((t) => {
        const raw = t as unknown as Record<string, unknown>;
        return {
          ...t,
          userName: userNameMap.get(t.userId) || '',
          companyName: companyNameMap.get(t.companyId) || '',
          departmentName: departmentNameMap.get(t.departmentId) || '',
          supervisorName: t.supervisorId ? supervisorNameMap.get(t.supervisorId) || '—' : '—',
          requiredHours: Number(raw.requiredHours || raw.totalHours || 300),
          completedHours: Number(raw.completedHours || raw.hoursRendered || 0),
        };
      });

      setTrainees(resolved);
      setTotal(result.total);
    } catch (err) {
      setError('Failed to load trainees');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTrainees();
  }, [fetchTrainees]);

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

  const handleStatusChange = (status: Trainee['status'] | undefined) => {
    setFilters((p) => ({ ...p, status, page: 1 }));
  };

  const handleOJTStatusChange = (ojtStatus: Trainee['ojtStatus'] | undefined) => {
    setFilters((p) => ({ ...p, ojtStatus, page: 1 }));
  };

  const handlePlacementTypeChange = (placementType: Trainee['placementType'] | undefined) => {
    setFilters((p) => ({ ...p, placementType, page: 1 }));
  };

  const handleOJTStatusUpdate = async (traineeId: string, newStatus: Trainee['ojtStatus']) => {
    setUpdatingStatus(traineeId);
    try {
      await adminService.updateTraineeOJTStatus(traineeId, newStatus);
      setTrainees((prev) =>
        prev.map((t) => (t.id === traineeId ? { ...t, ojtStatus: newStatus } : t)),
      );
      setStatusDropdownId(null);
      if (onStatusChange) {
        const updated = traineesRef.current.find((t) => t.id === traineeId);
        if (updated) onStatusChange({ ...updated, ojtStatus: newStatus });
      }
    } catch (err) {
      console.error('Failed to update OJT status:', err);
      setError('Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const totalPages = Math.ceil(total / (filters.limit || 10));

  return (
    <div className="space-y-4">
      {/* Search & Filter Header */}
      <div className="bg-card border border-border rounded-lg p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search trainees..."
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <span className="text-xs text-muted-foreground self-center sm:self-auto">
            {total} {total === 1 ? 'trainee' : 'trainees'} enrolled
          </span>
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50 text-xs">
          <select
            value={filters.status || ''}
            onChange={(e) => handleStatusChange((e.target.value as Trainee['status']) || undefined)}
            aria-label="Filter by status"
            className="px-2.5 py-1.5 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={filters.ojtStatus || ''}
            onChange={(e) => handleOJTStatusChange((e.target.value as Trainee['ojtStatus']) || undefined)}
            aria-label="Filter by OJT status"
            className="px-2.5 py-1.5 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All OJT Statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="completed">Completed</option>
            <option value="terminated">Terminated</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={filters.placementType || ''}
            onChange={(e) => handlePlacementTypeChange((e.target.value as Trainee['placementType']) || undefined)}
            aria-label="Filter by placement type"
            className="px-2.5 py-1.5 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Placement Types</option>
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
        </div>
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
                <Skeleton variant="text" width="40%" height={16} />
                <Skeleton variant="text" width="25%" height={12} />
              </div>
              <Skeleton variant="text" width={80} height={24} />
            </div>
          ))}
        </div>
      ) : trainees.length === 0 ? (
        <div className="bg-card border border-border rounded-lg">
          <EmptyState
            icon={InboxIcon}
            title="No trainees found"
            description={searchValue ? 'No trainees matched your search criteria.' : 'No trainees have been registered in the system.'}
          />
        </div>
      ) : (
        <>
          {/* Mobile Card Layout (< md) */}
          <div className="space-y-3 md:hidden">
            {trainees.map((trainee) => {
              const reqHours = Number(trainee.requiredHours || 300);
              const compHours = Number(trainee.completedHours || 0);
              const progressPct = reqHours > 0 ? Math.min(100, Math.round((compHours / reqHours) * 100)) : 0;

              return (
                <div key={trainee.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onView?.(trainee)}
                        className="font-semibold text-sm text-foreground hover:text-primary transition-colors truncate block text-left"
                      >
                        {trainee.userName || 'Unnamed Trainee'}
                      </button>
                      <p className="text-xs text-muted-foreground truncate">
                        ID: {trainee.profile?.studentId || '—'} {trainee.profile?.course ? `• ${trainee.profile.course}` : ''}
                      </p>
                    </div>
                    <ActionsMenu
                      items={[
                        ...(onView ? [{ label: 'View', onClick: () => onView(trainee) }] : []),
                        ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(trainee) }] : []),
                        ...(onViewDocuments ? [{ label: 'Documents', onClick: () => onViewDocuments(trainee) }] : []),
                      ]}
                    />
                  </div>

                  {/* OJT Progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>OJT Progress</span>
                      <span className="font-semibold text-foreground">{progressPct}% ({compHours}/{reqHours}h)</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Company</span>
                      <span className="text-foreground truncate block">{trainee.companyName || '—'}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Supervisor</span>
                      <span className="text-foreground truncate block">{trainee.supervisorName || '—'}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Type</span>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full font-medium ${
                        trainee.placementType === 'external' ? 'bg-accent/15 text-accent' : 'bg-primary/15 text-primary'
                      }`}>
                        {trainee.placementType === 'external' ? 'External' : 'Internal'}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">OJT Status</span>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full font-medium ${
                        ojtStatusBadgeClasses[trainee.ojtStatus] || 'bg-muted text-muted-foreground'
                      }`}>
                        {trainee.ojtStatus ? trainee.ojtStatus.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table Layout (>= md) */}
          <div className="hidden md:block bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Trainee
                  </th>
                  <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Student ID
                  </th>
                  <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Company
                  </th>
                  <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Supervisor
                  </th>
                  <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Type
                  </th>
                  <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    OJT Progress
                  </th>
                  <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Status
                  </th>
                  <th className="h-[44px] px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {trainees.map((trainee) => {
                  const reqHours = Number(trainee.requiredHours || 300);
                  const compHours = Number(trainee.completedHours || 0);
                  const progressPct = reqHours > 0 ? Math.min(100, Math.round((compHours / reqHours) * 100)) : 0;

                  return (
                    <tr key={trainee.id} className="h-[44px] hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => onView?.(trainee)}
                          className="font-medium text-foreground hover:text-primary transition-colors text-left"
                        >
                          {trainee.userName || 'Unnamed Trainee'}
                        </button>
                        {trainee.profile?.course && (
                          <p className="text-xs text-muted-foreground">{trainee.profile.course}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                        {trainee.profile?.studentId || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {trainee.companyName || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-foreground">
                        {trainee.supervisorName || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          trainee.placementType === 'external' ? 'bg-accent/15 text-accent' : 'bg-primary/15 text-primary'
                        }`}>
                          {trainee.placementType === 'external' ? 'External' : 'Internal'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 w-36">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{progressPct}%</span>
                            <span>{compHours}/{reqHours}h</span>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          ojtStatusBadgeClasses[trainee.ojtStatus] || 'bg-muted text-muted-foreground'
                        }`}>
                          {trainee.ojtStatus ? trainee.ojtStatus.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setStatusDropdownId(statusDropdownId === trainee.id ? null : trainee.id);
                              }}
                              className="px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-colors"
                              disabled={updatingStatus === trainee.id}
                            >
                              {updatingStatus === trainee.id ? '...' : 'Status'}
                            </button>
                            {statusDropdownId === trainee.id && (
                              <div className="absolute right-0 top-full mt-1 w-36 bg-card border border-border rounded-lg shadow-lg z-50 py-1 animate-[modal-enter_150ms_ease-out]">
                                {(['pending', 'active', 'on_leave', 'completed', 'terminated', 'archived'] as const).map((status) => (
                                  <button
                                    key={status}
                                    onClick={() => handleOJTStatusUpdate(trainee.id, status)}
                                    disabled={trainee.ojtStatus === status}
                                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors ${
                                      trainee.ojtStatus === status
                                        ? 'text-muted-foreground/50 cursor-not-allowed'
                                        : 'text-foreground'
                                    }`}
                                  >
                                    {status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <ActionsMenu
                            items={[
                              ...(onView ? [{ label: 'View', onClick: () => onView(trainee) }] : []),
                              ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(trainee) }] : []),
                              ...(onViewDocuments ? [{ label: 'Documents', onClick: () => onViewDocuments(trainee) }] : []),
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
  );
}
