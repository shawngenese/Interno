import { useState, useEffect, useCallback, useRef } from 'react';
import { listTasks, deleteTask } from '../services/taskService';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { TaskForm } from './TaskForm';
import { TaskDetail } from './TaskDetail';
import { EmptyState } from '@/shared/components/EmptyState';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { Search, Plus, Archive, Filter, CheckSquare, Clock } from 'lucide-react';
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
        <Button variant="ghost" size="sm" onClick={() => setSelectedTask(null)}>
          ← Back to tasks
        </Button>
        <TaskDetail taskId={selectedTask.id} onBack={() => setSelectedTask(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Task Management</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Assign, monitor, and review tasks for trainees</p>
        </div>
        {(role === 'supervisor' || role === 'admin') && (
          <Button
            variant="primary"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Create Task
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6 space-y-4">
        {error && (
          <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => { setError(null); fetchTasks(); }}>Retry</Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tasks by title or description..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              aria-label="Search tasks"
              className="w-full h-10 pl-9 pr-4 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value as TaskStatus | '')}
            aria-label="Filter by status"
            className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <input
            type="date"
            value={filters.dueDateTo}
            onChange={(e) => updateFilter('dueDateTo', e.target.value)}
            aria-label="Due date to"
            className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {(filters.status || filters.priority || filters.traineeId || filters.dueDateFrom || filters.dueDateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({ status: '', priority: '', traineeId: '', dueDateFrom: '', dueDateTo: '', search: filters.search })}
              className="border border-border"
            >
              <Filter className="w-3.5 h-3.5 mr-1" /> Clear Filters
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="rectangular" height={52} className="rounded-lg" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            title="No tasks found"
            description="Create a new task or adjust your filter criteria."
            action={
              role === 'supervisor' || role === 'admin'
                ? { label: 'Create Task', onClick: () => setShowForm(true) }
                : undefined
            }
          />
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden pt-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedTask(task)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedTask(task);
                    }
                  }}
                  className="bg-card border border-border rounded-xl p-4 space-y-3 hover:border-primary transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">{task.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{task.description}</p>
                    </div>
                    {(role === 'supervisor' || role === 'admin') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArchive(task.id); }}
                        className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors shrink-0"
                        aria-label="Archive task"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 font-semibold rounded-full ${TASK_STATUS_COLORS[task.status].bg} ${TASK_STATUS_COLORS[task.status].text}`}>
                        {TASK_STATUS_LABELS[task.status]}
                      </span>
                      <span className={`px-2 py-0.5 font-semibold rounded-full ${TASK_PRIORITY_COLORS[task.priority].bg} ${TASK_PRIORITY_COLORS[task.priority].text}`}>
                        {TASK_PRIORITY_LABELS[task.priority]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-border mt-2">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="h-[44px] text-left px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Task</th>
                    <th className="h-[44px] text-center px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="h-[44px] text-center px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Priority</th>
                    <th className="h-[44px] text-center px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Due Date</th>
                    <th className="h-[44px] text-right px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tasks.map((task) => (
                    <tr
                      key={task.id}
                      className="h-[44px] hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedTask(task)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground text-sm">{task.title}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-md">{task.description}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${TASK_STATUS_COLORS[task.status].bg} ${TASK_STATUS_COLORS[task.status].text}`}>
                          {TASK_STATUS_LABELS[task.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${TASK_PRIORITY_COLORS[task.priority].bg} ${TASK_PRIORITY_COLORS[task.priority].text}`}>
                          {TASK_PRIORITY_LABELS[task.priority]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                        {new Date(task.dueDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {(role === 'supervisor' || role === 'admin') && (
                          <button
                            onClick={() => handleArchive(task.id)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"
                            aria-label="Archive task"
                            title="Archive task"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    </div>
  );
}

