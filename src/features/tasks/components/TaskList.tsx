import { useState, useEffect, useCallback, useRef } from 'react';
import { listTasks, deleteTask, bulkReviewTasks } from '../services/taskService';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { TaskForm } from './TaskForm';
import { TaskDetail } from './TaskDetail';
import { EmptyState, ClipboardIcon } from '@/shared/components/EmptyState';
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
  status: TaskStatus[];
  priority: TaskPriority[];
  traineeId: string;
  dueDateFrom: string;
  dueDateTo: string;
  search: string;
}

export function TaskList() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [companyId, setCompanyId] = useState<string>('');
  const [filters, setFilters] = useState<TaskFilters>({
    status: [],
    priority: [],
    traineeId: '',
    dueDateFrom: '',
    dueDateTo: '',
    search: '',
  });
  const [trainees, setTrainees] = useState<{ id: string; name: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateFilter = useCallback(<K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listTasks({
        status: filters.status.length > 0 ? filters.status : undefined,
        priority: filters.priority.length > 0 ? filters.priority : undefined,
        search: filters.search || undefined,
        createdBy: user?.uid,
        traineeId: filters.traineeId || undefined,
        dueDateFrom: filters.dueDateFrom ? new Date(filters.dueDateFrom).getTime() : undefined,
        dueDateTo: filters.dueDateTo ? new Date(filters.dueDateTo).getTime() + 86400000 : undefined,
      });
      setTasks(result.data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, user]);

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
    async function loadCompanyId() {
      if (!user?.uid) return;
      try {
        const db = getFirestoreInstancePublic();
        const snap = await getDocs(
          query(collection(db, 'users'), where('__name__', '==', user.uid))
        );
        if (!snap.empty) {
          setCompanyId(snap.docs[0].data().companyId || '');
        }

        const traineeSnap = await getDocs(
          query(collection(db, 'trainees'), where('status', '==', 'active'))
        );

        const traineeIds = traineeSnap.docs.map((d) => d.id);
        const userMap = new Map<string, string>();

        const chunks = chunkArray(traineeIds, FIRESTORE_IN_LIMIT);
        for (const chunk of chunks) {
          const userSnap = await getDocs(
            query(collection(db, 'users'), where('__name__', 'in', chunk))
          );
          userSnap.docs.forEach((doc) => {
            userMap.set(doc.id, doc.data().displayName || doc.id);
          });
        }

        const tOptions = traineeIds.map((id) => ({
          id,
          name: userMap.get(id) || id,
        }));
        setTrainees(tOptions);
      } catch (err) {
        console.error('Failed to load company:', err);
      }
    }
    loadCompanyId();
  }, [user?.uid]);

  const handleBulkReview = async (action: 'approved' | 'returned') => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${action === 'approved' ? 'Approve' : 'Return'} ${selectedIds.size} task(s)?`)) return;

    try {
      await bulkReviewTasks(Array.from(selectedIds), action);
      setSelectedIds(new Set());
      fetchTasks();
    } catch (err) {
      console.error('Bulk review failed:', err);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Archive this task?')) return;
    try {
      await deleteTask(taskId);
      fetchTasks();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map((t) => t.id)));
    }
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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tasks</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + Create Task
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search tasks..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              aria-label="Search tasks"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              multiple
              value={filters.status}
              onChange={(e) => updateFilter('status', Array.from(e.target.selectedOptions, (o) => o.value as TaskStatus))}
              aria-label="Filter by status"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
              size={1}
            >
              <option value="">All Status</option>
              {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              multiple
              value={filters.priority}
              onChange={(e) => updateFilter('priority', Array.from(e.target.selectedOptions, (o) => o.value as TaskPriority))}
              aria-label="Filter by priority"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
              size={1}
            >
              <option value="">All Priority</option>
              {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={filters.traineeId}
              onChange={(e) => updateFilter('traineeId', e.target.value)}
              aria-label="Filter by trainee"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
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
              placeholder="Due from"
              aria-label="Due date from"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={filters.dueDateTo}
              onChange={(e) => updateFilter('dueDateTo', e.target.value)}
              placeholder="Due to"
              aria-label="Due date to"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <span className="text-sm text-blue-700 dark:text-blue-300">{selectedIds.size} selected</span>
          <button onClick={() => handleBulkReview('approved')} className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700">
            Approve All
          </button>
          <button onClick={() => handleBulkReview('returned')} className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700">
            Return All
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700">
            Clear
          </button>
        </div>
      )}

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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === tasks.length && tasks.length > 0}
                    onChange={toggleSelectAll}
                    aria-label="Select all tasks"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Task</th>
                <th className="text-center px-4 py-3 font-medium text-gray-700 dark:text-gray-300 hidden sm:table-cell">Status</th>
                <th className="text-center px-4 py-3 font-medium text-gray-700 dark:text-gray-300 hidden md:table-cell">Priority</th>
                <th className="text-center px-4 py-3 font-medium text-gray-700 dark:text-gray-300 hidden lg:table-cell">Due</th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                  onClick={() => setSelectedTask(task)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(task.id)}
                      onChange={() => toggleSelect(task.id)}
                      aria-label={`Select ${task.title}`}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{task.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{task.description}</p>
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
                  <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400 text-xs hidden lg:table-cell">
                    {new Date(task.dueDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="text-gray-400 hover:text-red-500"
                      aria-label="Delete task"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
