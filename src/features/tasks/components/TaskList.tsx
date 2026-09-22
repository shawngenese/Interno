import { useState, useEffect, useCallback, useRef } from 'react';
import { listTasks, deleteTask } from '../services/taskService';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { TaskForm } from './TaskForm';
import { TaskDetail } from './TaskDetail';
import { EmptyState, ClipboardIcon } from '@/shared/components/EmptyState';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import type { Task, TaskStatus, TaskPriority } from '../types';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_COLORS, TASK_PRIORITY_COLORS } from '../types';

const FIRESTORE_IN_LIMIT = 30;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface TaskFilters {
  status: TaskStatus | '';
  priority: TaskPriority | '';
  traineeId: string;
  dueDateFrom: string;
  dueDateTo: string;
  search: string;
}

export function TaskList() {
  const { user, role } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [companyId, setCompanyId] = useState<string>('');
  const [filters, setFilters] = useState<TaskFilters>({
    status: '',
    priority: '',
    traineeId: '',
    dueDateFrom: '',
    dueDateTo: '',
    search: '',
  });
  const [trainees, setTrainees] = useState<{ id: string; name: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const updateFilter = useCallback(<K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const traineeIds = filters.traineeId
        ? [filters.traineeId]
        : trainees.map((t) => t.id);

      const result = await listTasks({
        status: filters.status ? [filters.status] : undefined,
        priority: filters.priority ? [filters.priority] : undefined,
        search: filters.search || undefined,
        createdBy: role === 'admin' ? user?.uid : undefined,
        traineeIds: traineeIds.length > 0 ? traineeIds : undefined,
        dueDateFrom: filters.dueDateFrom ? new Date(filters.dueDateFrom).getTime() : undefined,
        dueDateTo: filters.dueDateTo ? new Date(filters.dueDateTo).getTime() + 86400000 : undefined,
      });
      setTasks(result.data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setError('Failed to load tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, user, role, trainees]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchTasks();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchTasks]);

  useEffect(() => {
    let isMounted = true;
    async function loadCompanyId() {
      if (!user) return;
      try {
        const tokenResult = await user.getIdTokenResult();
        const resolvedCompanyId = (tokenResult.claims.companyId as string) || '';
        if (isMounted) setCompanyId(resolvedCompanyId);

        const db = getFirestoreInstancePublic();
        const traineeQuery = query(
          collection(db, 'trainees'),
          where('supervisorId', '==', user.uid),
          where('status', '==', 'active')
        );
        const traineeSnap = await getDocs(traineeQuery);
        if (!isMounted) return;

        const traineeData = traineeSnap.docs.map((d) => ({ id: d.id, userId: d.data().userId }));
        const userIds = [...new Set(traineeData.map((t) => t.userId).filter(Boolean))];
        const userMap = new Map<string, string>();

        const chunks = chunkArray(userIds, FIRESTORE_IN_LIMIT);
        for (const chunk of chunks) {
          const userSnap = await getDocs(
            query(collection(db, 'users'), where('__name__', 'in', chunk))
          );
          userSnap.docs.forEach((doc) => {
            userMap.set(doc.id, doc.data().displayName || doc.id);
          });
        }
        if (!isMounted) return;

        const tOptions = traineeData.map((t) => ({
          id: t.id,
          name: userMap.get(t.userId) || t.id,
        }));
        setTrainees(tOptions);
      } catch (err) {
        if (isMounted) console.error('Failed to load company:', err);
      }
    }
    loadCompanyId();
    return () => { isMounted = false; };
  }, [user]);

  const handleArchive = async (taskId: string) => {
    setConfirmDialog({
      title: 'Archive Task',
      message: 'Archive this task?',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteTask(taskId);
          fetchTasks();
        } catch (err) {
          console.error('Archive failed:', err);
        }
      },
    });
  };

  if (showForm) {
    return (
      <div className="space-y-4">
        <TaskForm companyId={companyId} onSaved={() => { setShowForm(false); fetchTasks(); }} onCancel={() => setShowForm(false)} />
      </div>
    );
  }

  if (selectedTask) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedTask(null)} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700">
          ← Back to tasks
        </button>
        <TaskDetail taskId={selectedTask.id} onBack={() => setSelectedTask(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-[#121212] dark:text-white">Tasks</h2>
        {(role === 'supervisor' || role === 'admin') && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            + Create Task
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => { setError(null); fetchTasks(); }} className="text-sm font-medium text-red-700 dark:text-red-400 hover:underline">Retry</button>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <input
            type="text"
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            aria-label="Search tasks"
            className="w-full sm:w-64 px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value as TaskStatus | '')}
            aria-label="Filter by status"
            className="px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={filters.priority}
            onChange={(e) => updateFilter('priority', e.target.value as TaskPriority | '')}
            aria-label="Filter by priority"
            className="px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Priority</option>
            {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={filters.traineeId}
            onChange={(e) => updateFilter('traineeId', e.target.value)}
            aria-label="Filter by trainee"
            className="px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Trainees</option>
            {trainees.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <input
            type="date"
            value={filters.dueDateFrom}
            onChange={(e) => updateFilter('dueDateFrom', e.target.value)}
            aria-label="Due date from"
            className="px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <input
            type="date"
            value={filters.dueDateTo}
            onChange={(e) => updateFilter('dueDateTo', e.target.value)}
            aria-label="Due date to"
            className="px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {(filters.status || filters.priority || filters.traineeId || filters.dueDateFrom || filters.dueDateTo) && (
            <button
              onClick={() => setFilters({ status: '', priority: '', traineeId: '', dueDateFrom: '', dueDateTo: '', search: filters.search })}
              className="px-3 py-2 text-xs font-medium text-[#555555] dark:text-[#9E9E9E] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardIcon}
          title="No tasks found"
          description="Create a new task or adjust your filters."
        />
      ) : (
        <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#D5D5D5] dark:border-[#3A3A3A] bg-[#F5F5F5] dark:bg-[#3A3A3A]/50">
                <th className="text-left px-4 py-3 font-medium text-[#3A3A3A] dark:text-[#BDBDBD]">Task</th>
                <th className="text-center px-4 py-3 font-medium text-[#3A3A3A] dark:text-[#BDBDBD] hidden sm:table-cell">Status</th>
                <th className="text-center px-4 py-3 font-medium text-[#3A3A3A] dark:text-[#BDBDBD] hidden md:table-cell">Priority</th>
                <th className="text-center px-4 py-3 font-medium text-[#3A3A3A] dark:text-[#BDBDBD] hidden lg:table-cell">Due</th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  className="border-b border-gray-100 dark:border-[#3A3A3A]/50 hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/30 cursor-pointer"
                  onClick={() => setSelectedTask(task)}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-[#121212] dark:text-white">{task.title}</p>
                      <p className="text-xs text-[#757575] dark:text-[#9E9E9E] truncate max-w-xs">{task.description}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${TASK_STATUS_COLORS[task.status].bg} ${TASK_STATUS_COLORS[task.status].text}`}>
                      {TASK_STATUS_LABELS[task.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${TASK_PRIORITY_COLORS[task.priority].bg} ${TASK_PRIORITY_COLORS[task.priority].text}`}>
                      {TASK_PRIORITY_LABELS[task.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-[#555555] dark:text-[#9E9E9E] text-xs hidden lg:table-cell">
                    {new Date(task.dueDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {(role === 'supervisor' || role === 'admin') && (
                      <button
                        onClick={() => handleArchive(task.id)}
                        className="text-[#9E9E9E] hover:text-orange-500"
                        aria-label="Archive task"
                        title="Archive task"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        danger={confirmDialog?.danger}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
