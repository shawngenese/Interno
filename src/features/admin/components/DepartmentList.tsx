import { useState, useEffect, useCallback, useRef } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { EmptyState, InboxIcon } from '@/shared/components/EmptyState';
import { Skeleton } from '@/shared/components/Skeleton';
import { Button } from '@/shared/components/ui/Button';
import { Search } from 'lucide-react';
import type { Department, ListDepartmentsParams } from '../types';

interface DepartmentListProps {
  onEdit?: (department: Department) => void;
  companyId?: string;
}

interface ResolvedDepartment extends Department {
  companyName?: string;
  headSupervisorName?: string;
}

export function DepartmentList({ onEdit, companyId: propCompanyId }: DepartmentListProps) {
  const [departments, setDepartments] = useState<ResolvedDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<ListDepartmentsParams>({
    page: 1,
    limit: 10,
    companyId: propCompanyId,
  });
  const [searchValue, setSearchValue] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminService.listDepartments(filters);
      const resolved = await Promise.all(
        result.data.map(async (d) => {
          const [companyName, headSupervisorName] = await Promise.all([
            resolveDocName('companies', d.companyId, 'name'),
            d.headSupervisorId ? resolveDocName('users', d.headSupervisorId, 'displayName') : Promise.resolve(''),
          ]);
          return { ...d, companyName, headSupervisorName };
        }),
      );
      setDepartments(resolved);
      setPagination((prev) => ({
        ...prev,
        total: result.total,
        totalPages: result.totalPages,
      }));
    } catch (err) {
      setError('Failed to load departments');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handlePageChange = (page: number) => {
    setPagination((p) => ({ ...p, page }));
    setFilters((p: typeof filters) => ({ ...p, page }));
  };

  const handleSearch = (search: string) => {
    setSearchValue(search);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setFilters((p) => ({ ...p, search, page: 1 }));
    }, 350);
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const handleDelete = (id: string) => {
    setConfirmDialog({
      title: 'Delete Department',
      message: 'Are you sure you want to delete this department? This action cannot be undone.',
      danger: true,
      onConfirm: async () => {
        try {
          await adminService.deleteDepartment(id);
          fetchDepartments();
        } catch (err) {
          setError('Failed to delete department');
          console.error(err);
        }
      },
    });
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
              placeholder="Search departments..."
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <span className="text-xs text-muted-foreground self-center sm:self-auto">
            {pagination.total} {pagination.total === 1 ? 'department' : 'departments'} registered
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
        ) : departments.length === 0 ? (
          <div className="bg-card border border-border rounded-lg">
            <EmptyState
              icon={InboxIcon}
              title="No departments found"
              description={searchValue ? 'No departments matched your search criteria.' : 'No departments have been configured yet.'}
            />
          </div>
        ) : (
          <>
            {/* Mobile Card Layout (< md) */}
            <div className="space-y-3 md:hidden">
              {departments.map((department) => (
                <div key={department.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onEdit?.(department)}
                        className="font-semibold text-sm text-foreground hover:text-primary transition-colors truncate block text-left"
                      >
                        {department.name}
                      </button>
                      <p className="text-xs text-muted-foreground truncate">{department.companyName || 'No company assigned'}</p>
                    </div>
                    <ActionsMenu
                      items={[
                        ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(department) }] : []),
                        { label: 'Delete', onClick: () => handleDelete(department.id), danger: true },
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                    <div className="col-span-2">
                      <span className="text-muted-foreground block">Head Supervisor</span>
                      <span className="text-foreground">{department.headSupervisorName || '—'}</span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-muted-foreground block">Description</span>
                      <span className="text-muted-foreground line-clamp-2">{department.description || '—'}</span>
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
                      Department Name
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Company
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Head Supervisor
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Description
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Created
                    </th>
                    <th className="h-[44px] px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {departments.map((department) => (
                    <tr key={department.id} className="h-[44px] hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => onEdit?.(department)}
                          className="font-medium text-foreground hover:text-primary transition-colors text-left"
                        >
                          {department.name}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {department.companyName || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-foreground">
                        {department.headSupervisorName || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-xs truncate">
                        {department.description || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {department.createdAt?.seconds ? new Date(department.createdAt.seconds * 1000).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ActionsMenu
                          items={[
                            ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(department) }] : []),
                            { label: 'Delete', onClick: () => handleDelete(department.id), danger: true },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="p-4 bg-card border border-border rounded-lg flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
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