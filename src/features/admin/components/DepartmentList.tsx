import { useState, useEffect, useCallback, useRef } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
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
      setPagination(prev => ({
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
    setPagination(p => ({ ...p, page }));
    setFilters((p: typeof filters) => ({ ...p, page }));
  };

  const handleSearch = (search: string) => {
    setSearchValue(search);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setFilters(p => ({ ...p, search, page: 1 }));
    }, 400);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    try {
      await adminService.deleteDepartment(id);
      fetchDepartments();
    } catch (err) {
      setError('Failed to delete department');
      console.error(err);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
      <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-semibold text-[#121212] dark:text-white">Departments</h3>
          <input
            type="text"
            placeholder="Search departments..."
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
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Company</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Head Supervisor</th>
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
                    Loading departments...
                  </div>
                </td>
              </tr>
            ) : departments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#757575] dark:text-[#9E9E9E]">
                  No departments found
                </td>
              </tr>
            ) : (
              departments.map((department) => (
                <tr key={department.id} className="hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/50">
                  <td className="px-4 py-4">
                    <button
                      onClick={() => onEdit?.(department)}
                      className="font-medium text-[#121212] dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {department.name}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {department.companyName || '—'}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {department.description || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {department.headSupervisorName || '—'}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {department.createdAt?.seconds ? new Date(department.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <ActionsMenu
                      items={[
                        ...(onEdit ? [{ label: 'Edit', onClick: () => onEdit(department) }] : []),
                        { label: 'Delete', onClick: () => handleDelete(department.id), danger: true },
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