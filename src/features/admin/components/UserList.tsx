import { useState, useEffect, useCallback, useRef } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { useAuth } from '@/features/auth';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { EmptyState, InboxIcon } from '@/shared/components/EmptyState';
import { Skeleton } from '@/shared/components/Skeleton';
import { Button } from '@/shared/components/ui/Button';
import { Search } from 'lucide-react';
import type { User, ListUsersParams } from '../types';

interface UserListProps {
  onEdit?: (user: User) => void;
  onView?: (user: User) => void;
}

interface ResolvedUser extends User {
  companyName?: string;
}

const roleBadgeClasses: Record<string, string> = {
  admin: 'bg-accent/15 text-accent',
  supervisor: 'bg-primary/15 text-primary',
  coordinator: 'bg-success/15 text-success',
  trainee: 'bg-muted text-muted-foreground',
};

const statusBadgeClasses: Record<string, string> = {
  active: 'bg-success/15 text-success',
  inactive: 'bg-muted text-muted-foreground',
  pending: 'bg-warning/15 text-warning',
  archived: 'bg-destructive/15 text-destructive',
};

export function UserList({ onEdit, onView }: UserListProps) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ResolvedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<ListUsersParams>({
    page: 1,
    limit: 10,
  });
  const [searchValue, setSearchValue] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminService.listUsers(filters);
      const resolved = await Promise.all(
        result.data.map(async (u) => {
          const companyName = await resolveDocName('companies', u.companyId, 'name');
          return { ...u, companyName };
        }),
      );
      setUsers(resolved);
      setPagination((prev) => ({
        ...prev,
        total: result.total,
        totalPages: result.totalPages,
      }));
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handlePageChange = (page: number) => {
    setPagination((p) => ({ ...p, page }));
    setFilters((p) => ({ ...p, page }));
  };

  const handleSearch = (search: string) => {
    setSearchValue(search);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setFilters((p) => ({ ...p, search, page: 1 }));
    }, 350);
  };

  useEffect(() => {
    setPagination((p) => ({ ...p, page: filters.page ?? 1 }));
  }, [filters.page]);

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const handleDelete = (uid: string) => {
    setConfirmDialog({
      title: 'Delete User',
      message: 'Are you sure you want to delete this user? This action cannot be undone.',
      danger: true,
      onConfirm: async () => {
        try {
          await adminService.deleteUser(uid);
          fetchUsers();
        } catch (err) {
          setError('Failed to delete user');
          console.error(err);
        }
      },
    });
  };

  const handleArchive = (uid: string) => {
    setConfirmDialog({
      title: 'Archive User',
      message: 'Are you sure you want to archive this user?',
      danger: true,
      onConfirm: async () => {
        try {
          await adminService.archiveUser(uid);
          fetchUsers();
        } catch (err) {
          setError('Failed to archive user');
          console.error(err);
        }
      },
    });
  };

  const handleRestore = (uid: string) => {
    setConfirmDialog({
      title: 'Restore User',
      message: 'Are you sure you want to restore this user?',
      onConfirm: async () => {
        try {
          await adminService.restoreUser(uid);
          fetchUsers();
        } catch (err) {
          setError('Failed to restore user');
          console.error(err);
        }
      },
    });
  };

  return (
    <>
      <div className="space-y-4">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border border-border rounded-lg p-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <span className="text-xs text-muted-foreground self-center sm:self-auto">
            {pagination.total} {pagination.total === 1 ? 'user' : 'users'} registered
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
                  <Skeleton variant="text" width="40%" height={16} />
                  <Skeleton variant="text" width="25%" height={12} />
                </div>
                <Skeleton variant="text" width={80} height={24} />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="bg-card border border-border rounded-lg">
            <EmptyState
              icon={InboxIcon}
              title="No users found"
              description={searchValue ? 'No users matched your search criteria.' : 'No users have been registered yet.'}
            />
          </div>
        ) : (
          <>
            {/* Mobile Card Layout (< md) */}
            <div className="space-y-3 md:hidden">
              {users.map((user) => (
                <div key={user.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onView?.(user)}
                        className="font-semibold text-sm text-foreground hover:text-primary transition-colors truncate block text-left"
                      >
                        {user.displayName || 'Unnamed User'}
                      </button>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <ActionsMenu
                      items={[
                        ...(onEdit && currentUser?.uid !== user.id
                          ? [{ label: 'Edit', onClick: () => onEdit(user) }]
                          : []),
                        ...(currentUser?.uid !== user.id
                          ? user.status === 'archived'
                            ? [{ label: 'Restore', onClick: () => handleRestore(user.id) }]
                            : [
                                { label: 'Archive', onClick: () => handleArchive(user.id) },
                                { label: 'Delete', onClick: () => handleDelete(user.id), danger: true },
                              ]
                          : []),
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Role</span>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full font-medium ${roleBadgeClasses[user.role ?? ''] || 'bg-muted text-muted-foreground'}`}>
                        {(user.role ?? 'unknown').charAt(0).toUpperCase() + (user.role ?? 'unknown').slice(1)}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Status</span>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full font-medium ${statusBadgeClasses[user.status ?? 'active'] || 'bg-muted text-muted-foreground'}`}>
                        {(user.status ?? 'active').charAt(0).toUpperCase() + (user.status ?? 'active').slice(1)}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-muted-foreground block">Company</span>
                      <span className="text-foreground">{user.companyName || '—'}</span>
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
                      User
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Role
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Company
                    </th>
                    <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Status
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
                  {users.map((user) => (
                    <tr key={user.id} className="h-[44px] hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onView?.(user)}
                            className="font-medium text-foreground hover:text-primary transition-colors text-left"
                          >
                            {user.displayName || 'Unnamed User'}
                          </button>
                          {currentUser?.uid === user.id && (
                            <span className="text-xs px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${roleBadgeClasses[user.role ?? ''] || 'bg-muted text-muted-foreground'}`}>
                          {(user.role ?? 'unknown').charAt(0).toUpperCase() + (user.role ?? 'unknown').slice(1)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">
                        {user.companyName || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusBadgeClasses[user.status ?? 'active'] || 'bg-muted text-muted-foreground'}`}>
                          {(user.status ?? 'active').charAt(0).toUpperCase() + (user.status ?? 'active').slice(1)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {user.createdAt?.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ActionsMenu
                          items={[
                            ...(onEdit && currentUser?.uid !== user.id
                              ? [{ label: 'Edit', onClick: () => onEdit(user) }]
                              : []),
                            ...(currentUser?.uid !== user.id
                              ? user.status === 'archived'
                                ? [{ label: 'Restore', onClick: () => handleRestore(user.id) }]
                                : [
                                    { label: 'Archive', onClick: () => handleArchive(user.id) },
                                    { label: 'Delete', onClick: () => handleDelete(user.id), danger: true },
                                  ]
                              : []),
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