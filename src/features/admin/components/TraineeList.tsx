import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/adminService';
import type { Trainee, ListTraineesParams } from '../types';

interface TraineeListProps {
  onEdit?: (trainee: Trainee) => void;
  onView?: (trainee: Trainee) => void;
}

export function TraineeList({ onEdit, onView }: TraineeListProps) {
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ListTraineesParams>({ page: 1, limit: 10 });
  const [total, setTotal] = useState(0);

  const fetchTrainees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminService.listTrainees(filters);
      setTrainees(result.data);
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
    setFilters(p => ({ ...p, search, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(p => ({ ...p, page }));
  };

  const handleStatusChange = (status: Trainee['status'] | undefined) => {
    setFilters(p => ({ ...p, status, page: 1 }));
  };

  const handleOJTStatusChange = (ojtStatus: Trainee['ojtStatus'] | undefined) => {
    setFilters(p => ({ ...p, ojtStatus, page: 1 }));
  };

  const totalPages = Math.ceil(total / (filters.limit || 10));

  const getStatusColor = (status: Trainee['status']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'archived': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getOJTStatusColor = (ojtStatus: Trainee['ojtStatus']) => {
    switch (ojtStatus) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'on_leave': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'completed': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'terminated': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'archived': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Trainees</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search trainees..."
              value={filters.search || ''}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full sm:w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-3">
          <select
            value={filters.status || ''}
            onChange={(e) => handleStatusChange((e.target.value as Trainee['status']) || undefined)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All OJT Statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="completed">Completed</option>
            <option value="terminated">Terminated</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Course</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Company</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Department</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supervisor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">OJT Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {trainees.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No trainees found
                </td>
              </tr>
            ) : (
              trainees.map(trainee => (
                <tr key={trainee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-white font-medium">
                    {trainee.profile?.studentId || trainee.userId}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {trainee.profile?.studentId || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {trainee.profile?.course || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {trainee.companyId}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {trainee.departmentId}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {trainee.supervisorId || '-'}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(trainee.status)}`}>
                      {trainee.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getOJTStatusColor(trainee.ojtStatus)}`}>
                      {trainee.ojtStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onView && (
                        <button
                          onClick={() => onView(trainee)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        >
                          View
                        </button>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(trainee)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Page {filters.page} of {totalPages} ({total} total)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange((filters.page || 1) - 1)}
              disabled={(filters.page || 1) <= 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange((filters.page || 1) + 1)}
              disabled={(filters.page || 1) >= totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}