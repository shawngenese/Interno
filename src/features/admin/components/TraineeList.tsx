import { useState, useEffect, useCallback, useRef } from 'react';
import { adminService } from '../services/adminService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
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
}

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

  // Keep ref in sync with state
  useEffect(() => {
    traineesRef.current = trainees;
  }, [trainees]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Close status dropdown on outside click
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
      const resolved = await Promise.all(
        result.data.map(async (t) => {
          const [userName, companyName, departmentName] = await Promise.all([
            resolveDocName('users', t.userId, 'displayName'),
            resolveDocName('companies', t.companyId, 'name'),
            resolveDocName('departments', t.departmentId, 'name'),
          ]);
          let supervisorName = '-';
          if (t.supervisorId) {
            const supDoc = await getDoc(doc(db, 'supervisors', t.supervisorId));
            if (supDoc.exists()) {
              const supUserId = (supDoc.data() as Record<string, unknown>).userId as string;
              if (supUserId) {
                supervisorName = await resolveDocName('users', supUserId, 'displayName') || '-';
              }
            }
          }
          return { ...t, userName, companyName, departmentName, supervisorName };
        }),
      );
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
      setFilters(p => ({ ...p, search, page: 1 }));
    }, 400);
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

  const handlePlacementTypeChange = (placementType: Trainee['placementType'] | undefined) => {
    setFilters(p => ({ ...p, placementType, page: 1 }));
  };

  const handleOJTStatusUpdate = async (traineeId: string, newStatus: Trainee['ojtStatus']) => {
    setUpdatingStatus(traineeId);
    try {
      await adminService.updateTraineeOJTStatus(traineeId, newStatus);
      setTrainees(prev => prev.map(t => 
        t.id === traineeId ? { ...t, ojtStatus: newStatus } : t
      ));
      setStatusDropdownId(null);
      if (onStatusChange) {
        const updated = traineesRef.current.find(t => t.id === traineeId);
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

  const getStatusColor = (status: Trainee['status']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'inactive': return 'bg-[#EFEFEF] text-[#1E1E1E] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'archived': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-[#EFEFEF] text-[#1E1E1E] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]';
    }
  };

  const getOJTStatusColor = (ojtStatus: Trainee['ojtStatus']) => {
    switch (ojtStatus) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'on_leave': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'completed': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'terminated': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'archived': return 'bg-[#EFEFEF] text-[#1E1E1E] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]';
      default: return 'bg-[#EFEFEF] text-[#1E1E1E] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]';
    }
  };

  if (loading && trainees.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
        <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-[#121212] dark:text-white">Trainees</h2>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search trainees..."
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full sm:w-64 px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
      <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-[#121212] dark:text-white">Trainees</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search trainees..."
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full sm:w-64 px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-3">
          <select
            value={filters.status || ''}
            onChange={(e) => handleStatusChange((e.target.value as Trainee['status']) || undefined)}
            aria-label="Filter by status"
            className="px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Placement Types</option>
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && trainees.length > 0 && (
        <div className="h-0.5 w-full overflow-hidden bg-[#EFEFEF] dark:bg-[#3A3A3A]">
          <div className="h-full bg-blue-600 animate-pulse" style={{ width: '40%' }} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#F5F5F5] dark:bg-[#3A3A3A]/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Name</th>
              <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Student ID</th>
              <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Course</th>
              <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Company</th>
              <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Department</th>
              <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Supervisor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">OJT Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D5D5D5] dark:divide-[#3A3A3A]">
            {trainees.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[#757575] dark:text-[#9E9E9E]">
                  No trainees found
                </td>
              </tr>
            ) : (
              trainees.map(trainee => (
                <tr key={trainee.id} className="hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/50">
                  <td className="px-4 py-4 text-sm text-[#121212] dark:text-white font-medium">
                    {trainee.userName || '—'}
                  </td>
                  <td className="hidden md:table-cell px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {trainee.profile?.studentId || '-'}
                  </td>
                  <td className="hidden md:table-cell px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {trainee.profile?.course || '-'}
                  </td>
                  <td className="hidden lg:table-cell px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {trainee.companyName || '—'}
                  </td>
                  <td className="hidden lg:table-cell px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {trainee.departmentName || '—'}
                  </td>
                  <td className="hidden lg:table-cell px-4 py-4 text-sm text-[#757575] dark:text-[#9E9E9E]">
                    {trainee.supervisorName || '-'}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${trainee.placementType === 'external' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                      {trainee.placementType === 'external' ? 'External' : 'Internal'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(trainee.status)}`}>
                      {trainee.status.charAt(0).toUpperCase() + trainee.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getOJTStatusColor(trainee.ojtStatus)}`}>
                      {trainee.ojtStatus.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setStatusDropdownId(statusDropdownId === trainee.id ? null : trainee.id); }}
                          className="px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                          disabled={updatingStatus === trainee.id}
                        >
                          {updatingStatus === trainee.id ? '...' : 'Status'}
                        </button>
                        {statusDropdownId === trainee.id && (
                          <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-[#1E1E1E] border border-[#D5D5D5] dark:border-[#3A3A3A] rounded-lg shadow-lg z-50 py-1">
                            {(['pending', 'active', 'on_leave', 'completed', 'terminated', 'archived'] as const).map(status => (
                              <button
                                key={status}
                                onClick={() => handleOJTStatusUpdate(trainee.id, status)}
                                disabled={trainee.ojtStatus === status}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-[#EFEFEF] dark:hover:bg-[#3A3A3A] ${
                                  trainee.ojtStatus === status
                                    ? 'text-[#9E9E9E] dark:text-[#757575] cursor-not-allowed'
                                    : 'text-[#3A3A3A] dark:text-[#BDBDBD]'
                                }`}
                              >
                                {status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-[#D5D5D5] dark:border-[#3A3A3A] flex items-center justify-between">
          <div className="text-sm text-[#757575] dark:text-[#9E9E9E]">
            Page {filters.page} of {totalPages} ({total} total)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange((filters.page || 1) - 1)}
              disabled={(filters.page || 1) <= 1}
              className="px-3 py-1 text-sm border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange((filters.page || 1) + 1)}
              disabled={(filters.page || 1) >= totalPages}
              className="px-3 py-1 text-sm border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
