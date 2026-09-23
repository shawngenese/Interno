import { useState, useEffect, useCallback, useRef } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { EmptyState, InboxIcon } from '@/shared/components/EmptyState';
import { Skeleton } from '@/shared/components/Skeleton';
import { Button } from '@/shared/components/ui/Button';
import { useAuth } from '@/features/auth';
import { Search } from 'lucide-react';
import type { Supervisor, ListSupervisorsParams } from '../types';

interface SupervisorListProps {
  onEdit?: (supervisor: Supervisor) => void;
  onView?: (supervisor: Supervisor) => void;
  onDelete?: (supervisor: Supervisor) => void;
  onAssignTrainees?: (supervisor: Supervisor) => void;
}

interface ResolvedSupervisor extends Supervisor {
  userName?: string;
  userEmail?: string;
  companyName?: string;
  departmentName?: string;
  type?: 'internal' | 'external';
}

export function SupervisorList({ onEdit, onView, onDelete, onAssignTrainees }: SupervisorListProps) {
  const { role } = useAuth();
  const [supervisors, setSupervisors] = useState<ResolvedSupervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ListSupervisorsParams>({ page: 1, limit: 10 });
  const [total, setTotal] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const fetchSupervisors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminService.listSupervisors(filters);
      const resolved = await Promise.all(
        result.data.map(async (s) => {
          const [userName, companyName, departmentName, userEmail] = await Promise.all([
            resolveDocName('users', s.userId, 'displayName'),
            resolveDocName('companies', s.companyId, 'name'),
            resolveDocName('departments', s.departmentId, 'name'),
            resolveDocName('users', s.userId, 'email'),
          ]);
          return { ...s, userName, userEmail, companyName, departmentName, type: 'internal' as const };
        }),
      );
      setSupervisors(resolved);
      setTotal(result.total);
    } catch (err) {
      setError('Failed to load supervisors');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors]);

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

  const handleDelete = (supervisor: ResolvedSupervisor) => {
    setConfirmDialog({
      title: 'Delete Supervisor',
      message: `Are you sure you want to delete supervisor "${supervisor.userName || 'this user'}"? This action cannot be undone.`,
      danger: true,
      onConfirm: async () => {
        try {
          await adminService.deleteUser(supervisor.userId);
          onDelete?.(supervisor);
          fetchSupervisors();
        } catch (err) {
          console.error('Failed to delete supervisor:', err);
          setError('Failed to delete supervisor');
        }
      },
    });
  };

  const totalPages = Math.ceil(total / (filters.limit || 10));

  return (
    <>
      <div className="space-y-4">
        {/* Search & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border border-border rounded-lg p-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search supervisors..."
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <span className="text-xs text-muted-foreground self-center sm:self-auto">
            {total} {total === 1 ? 'supervisor' : 'supervisors'} registered
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
        ) : supervisors.length === 0 ? (
          <div className="bg-card border border-border rounded-lg">
            <EmptyState
              icon={InboxIcon}
              title="No supervisors found"
              description={searchValue ? 'No supervisors matched your search criteria.' : 'No supervisors have been registered yet.'}
            />
          </div>
        ) : (
          <>
            {/* Mobile Card Layout (< md) */}
            <div className="space-y-3 md:hidden">
              {supervisors.map((supervisor) => (
                <div key={supervisor.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {supervisor.userName || 'Unnamed Supervisor'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{supervisor.userEmail || 'No email'}</p>
                    </div>
                    <ActionsMenu
                      items={[
                        ...(onView ? [{ label: 'View', onClick: () => onView(supervisor) }] : []),
                        ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(supervisor) }] : []),
                        ...(onAssignTrainees ? [{ label: 'Assign Trainees', onClick: () => onAssignTrainees(supervisor) }] : []),
                        ...(role === 'admin' ? [{ label: 'Delete', onClick: () => handleDelete(supervisor), danger: true }] : []),
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Company</span>
                      <span className="text-foreground truncate block">{supervisor.companyName || '—'}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Department</span>
                      <span className="text-foreground truncate block">{supervisor.departmentName || '—'}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Type</span>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full font-medium ${
                        supervisor.type === 'external' ? 'bg-accent/15 text-accent' : 'bg-primary/15 text-primary'
                      }`}>
                        {supervisor.type === 'external' ? 'External' : 'Internal'}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Assigned Trainees</span>
                      <span className="text-foreground font-semibold">
                        {supervisor.assignedTrainees?.length || 0}
                      </span>
                    </div>
                  </div>

                  {onAssignTrainees && (
                    <div className="pt-2 border-t border-border/40">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onAssignTrainees(supervisor)}
                        className="w-full text-xs"
                      >
                        Manage Trainee Assignments
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table Layout (>= md) */}
            <div className="hidden md:block bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Supervisor
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Company
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Department
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Type
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Assigned Trainees
                    </th>
                    <th className="h-[44px] px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {supervisors.map((supervisor) => (
                    <tr key={supervisor.id} className="h-[44px] hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{supervisor.userName || 'Unnamed Supervisor'}</p>
                        <p className="text-xs text-muted-foreground">{supervisor.userEmail || '—'}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {supervisor.companyName || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {supervisor.departmentName || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          supervisor.type === 'external' ? 'bg-accent/15 text-accent' : 'bg-primary/15 text-primary'
                        }`}>
                          {supervisor.type === 'external' ? 'External' : 'Internal'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-medium text-foreground">
                        {supervisor.assignedTrainees?.length || 0} trainees
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {onAssignTrainees && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onAssignTrainees(supervisor)}
                              className="text-xs text-primary hover:text-primary-hover h-8 px-2"
                            >
                              Assign
                            </Button>
                          )}
                          <ActionsMenu
                            items={[
                              ...(onView ? [{ label: 'View', onClick: () => onView(supervisor) }] : []),
                              ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(supervisor) }] : []),
                              ...(role === 'admin' ? [{ label: 'Delete', onClick: () => handleDelete(supervisor), danger: true }] : []),
                            ]}
                          />
                        </div>
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
