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
import type { User, ListUsersParams } from '../types';

interface CoordinatorListProps {
  onEdit?: (user: User) => void;
  onView?: (user: User) => void;
  onDelete?: (user: User) => void;
}

interface ResolvedCoordinator extends User {
  companyName?: string;
  departmentName?: string;
}

const statusBadgeClasses: Record<string, string> = {
  active: 'bg-success/15 text-success',
  inactive: 'bg-muted text-muted-foreground',
  pending: 'bg-warning/15 text-warning',
  archived: 'bg-destructive/15 text-destructive',
};

export function CoordinatorList({ onEdit, onView, onDelete }: CoordinatorListProps) {
  const { role } = useAuth();
  const [coordinators, setCoordinators] = useState<ResolvedCoordinator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ListUsersParams>({ page: 1, limit: 10, role: 'coordinator' });
  const [total, setTotal] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const fetchCoordinators = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminService.listUsers(filters);
      const resolved = await Promise.all(
        result.data.map(async (u) => {
          const [companyName, departmentName] = await Promise.all([
            resolveDocName('companies', u.companyId, 'name'),
            u.departmentId ? resolveDocName('departments', u.departmentId, 'name') : Promise.resolve(''),
          ]);
          return { ...u, companyName, departmentName };
        }),
      );
      setCoordinators(resolved);
      setTotal(result.total);
    } catch (err) {
      setError('Failed to load coordinators');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCoordinators();
  }, [fetchCoordinators]);

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

  const handleDelete = (coordinator: User) => {
    setConfirmDialog({
      title: 'Delete Coordinator',
      message: `Are you sure you want to delete coordinator "${coordinator.displayName || 'this user'}"? This action cannot be undone.`,
      danger: true,
      onConfirm: async () => {
        try {
          await adminService.deleteUser(coordinator.id);
          onDelete?.(coordinator);
          fetchCoordinators();
        } catch (err) {
          console.error('Failed to delete coordinator:', err);
          setError('Failed to delete coordinator');
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
              placeholder="Search coordinators..."
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <span className="text-xs text-muted-foreground self-center sm:self-auto">
            {total} {total === 1 ? 'coordinator' : 'coordinators'} registered
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
        ) : coordinators.length === 0 ? (
          <div className="bg-card border border-border rounded-lg">
            <EmptyState
              icon={InboxIcon}
              title="No coordinators found"
              description={searchValue ? 'No coordinators matched your search criteria.' : 'No departmental coordinators added yet.'}
            />
          </div>
        ) : (
          <>
            {/* Mobile Card Layout (< md) */}
            <div className="space-y-3 md:hidden">
              {coordinators.map((coordinator) => (
                <div key={coordinator.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onView?.(coordinator)}
                        className="font-semibold text-sm text-foreground hover:text-primary transition-colors truncate block text-left"
                      >
                        {coordinator.displayName || 'Unnamed Coordinator'}
                      </button>
                      <p className="text-xs text-muted-foreground truncate">{coordinator.email || 'No email'}</p>
                    </div>
                    <ActionsMenu
                      items={[
                        ...(onView ? [{ label: 'View', onClick: () => onView(coordinator) }] : []),
                        ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(coordinator) }] : []),
                        ...(role === 'admin' ? [{ label: 'Delete', onClick: () => handleDelete(coordinator), danger: true }] : []),
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Department</span>
                      <span className="text-foreground truncate block">{coordinator.departmentName || '—'}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Company</span>
                      <span className="text-foreground truncate block">{coordinator.companyName || '—'}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Status</span>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full font-medium ${statusBadgeClasses[coordinator.status || 'active'] || 'bg-muted text-muted-foreground'}`}>
                        {(coordinator.status || 'active').charAt(0).toUpperCase() + (coordinator.status || 'active').slice(1)}
                      </span>
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
                      Coordinator
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Email
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Company
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Department
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
                  {coordinators.map((coordinator) => (
                    <tr key={coordinator.id} className="h-[44px] hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => onView?.(coordinator)}
                          className="font-medium text-foreground hover:text-primary transition-colors text-left"
                        >
                          {coordinator.displayName || 'Unnamed Coordinator'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {coordinator.email || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {coordinator.companyName || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-foreground">
                        {coordinator.departmentName || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusBadgeClasses[coordinator.status || 'active'] || 'bg-muted text-muted-foreground'}`}>
                          {(coordinator.status || 'active').charAt(0).toUpperCase() + (coordinator.status || 'active').slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ActionsMenu
                          items={[
                            ...(onView ? [{ label: 'View', onClick: () => onView(coordinator) }] : []),
                            ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(coordinator) }] : []),
                            ...(role === 'admin' ? [{ label: 'Delete', onClick: () => handleDelete(coordinator), danger: true }] : []),
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
