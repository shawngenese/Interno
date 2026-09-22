import { useState, useEffect, useCallback, useRef } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { useAuth } from '@/features/auth';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import type { User, ListUsersParams } from '../types';

interface UserListProps {
  onEdit?: (user: User) => void;
  onView?: (user: User) => void;
}

interface ResolvedUser extends User {
  companyName?: string;
}

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
      setPagination(prev => ({
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
    setPagination(p => ({ ...p, page }));
    setFilters(p => ({ ...p, page }));
  };

  const handleSearch = (search: string) => {
    setSearchValue(search);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setFilters(p => ({ ...p, search, page: 1 }));
    }, 400);
  };

  useEffect(() => {
    setPagination(p => ({ ...p, page: filters.page ?? 1 }));
  }, [filters.page]);

  const handleDelete = async (uid: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await adminService.deleteUser(uid);
      fetchUsers();
    } catch (err) {
      setError('Failed to delete user');
      console.error(err);
    }
  };

  const handleArchive = async (uid: string) => {
    if (!confirm('Are you sure you want to archive this user?')) return;
    try {
      await adminService.archiveUser(uid);
      fetchUsers();
    } catch (err) {
      setError('Failed to archive user');
      console.error(err);
    }
  };

  const handleRestore = async (uid: string) => {
    if (!confirm('Are you sure you want to restore this user?')) return;
    try {
      await adminService.restoreUser(uid);
      fetchUsers();
    } catch (err) {
      setError('Failed to restore user');
      console.error(err);
    }
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    supervisor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    coordinator: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    trainee: 'bg-[#EFEFEF] text-[#1E1E1E] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    inactive: 'bg-[#EFEFEF] text-[#1E1E1E] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    archived: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
      <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-semibold text-[#121212] dark:text-white">Users</h3>
          <input
            type="text"
            placeholder="Search users..."
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full sm:w-64 px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#F5F5F5] dark:bg-[#3A3A3A]/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Company</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Created</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D5D5D5] dark:divide-[#3A3A3A]">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#757575] dark:text-[#9E9E9E]">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading users...
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#757575] dark:text-[#9E9E9E]">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/50">
                  <td className="px-4 py-4">
                    <div>
                      <button
                        onClick={() => onView?.(user)}
                        className="font-medium text-[#121212] dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {user.displayName}
                      </button>
                      {currentUser?.uid === user.id && (
                        <span className="ml-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium">(You)</span>
                      )}
                      <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${roleColors[user.role ?? ''] || 'bg-[#EFEFEF] text-[#1E1E1E] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]'}`}>
                      {(user.role ?? 'unknown').charAt(0).toUpperCase() + (user.role ?? 'unknown').slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {user.companyName || '—'}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[user.status ?? 'active'] || 'bg-[#EFEFEF] text-[#1E1E1E] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]'}`}>
                      {(user.status ?? 'active').charAt(0).toUpperCase() + (user.status ?? 'active').slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {user.createdAt?.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-4 text-right">
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="p-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A] flex items-center justify-between">
          <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-2 text-sm text-[#121212] dark:text-white border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-2 text-sm text-[#121212] dark:text-white border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}