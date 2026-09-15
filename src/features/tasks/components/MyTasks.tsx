import { useState, useEffect, useCallback, useMemo } from 'react';
import { getTraineeTasks, getTraineeTaskCounts } from '../services/taskService';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { TaskDetail } from './TaskDetail';
import { EmptyState, ClipboardIcon } from '@/shared/components/EmptyState';
import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS, TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS } from '../types';

export function MyTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState<Record<TaskStatus, number>>({
    pending: 0,
    in_progress: 0,
    submitted: 0,
    approved: 0,
    returned: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [traineeId, setTraineeId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      let resolvedTraineeId = traineeId;

      if (!resolvedTraineeId) {
        const db = getFirestoreInstancePublic();
        const traineeSnap = await getDocs(
          query(collection(db, 'trainees'), where('userId', '==', user.uid), where('status', '==', 'active'))
        );

        if (traineeSnap.empty) {
          setTasks([]);
          return;
        }

        resolvedTraineeId = traineeSnap.docs[0].id;
        setTraineeId(resolvedTraineeId);
      }

      const [allTasks, taskCounts] = await Promise.all([
        getTraineeTasks(resolvedTraineeId),
        getTraineeTaskCounts(resolvedTraineeId),
      ]);

      setTasks(allTasks);
      setCounts(taskCounts);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, traineeId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filteredTasks = useMemo(
    () => statusFilter === 'all' ? tasks : tasks.filter((t) => t.status === statusFilter),
    [tasks, statusFilter]
  );

  if (selectedTask) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setSelectedTask(null); fetchTasks(); }} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700">
          ← Back to My Tasks
        </button>
        <TaskDetail taskId={selectedTask.id} onBack={() => { setSelectedTask(null); fetchTasks(); }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Tasks</h2>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(['pending', 'in_progress', 'submitted', 'approved', 'returned'] as TaskStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
            className={`p-3 rounded-lg border text-center transition-colors ${
              statusFilter === status
                ? 'ring-2 ring-blue-500 border-blue-300 dark:border-blue-700'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <p className={`text-2xl font-bold ${TASK_STATUS_COLORS[status].text}`}>{counts[status]}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{TASK_STATUS_LABELS[status]}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={ClipboardIcon}
          title={statusFilter === 'all' ? 'No tasks assigned yet' : `No ${TASK_STATUS_LABELS[statusFilter].toLowerCase()} tasks`}
          description={statusFilter === 'all' ? 'Tasks assigned to you will appear here.' : 'Try a different filter.'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredTasks.map((task) => {
            const isOverdue = task.dueDate < Date.now() && task.status !== 'approved';
            return (
              <button
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="w-full text-left bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">{task.title}</h3>
                      {isOverdue && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{task.description}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TASK_STATUS_COLORS[task.status].bg} ${TASK_STATUS_COLORS[task.status].text}`}>
                      {TASK_STATUS_LABELS[task.status]}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TASK_PRIORITY_COLORS[task.priority].bg} ${TASK_PRIORITY_COLORS[task.priority].text}`}>
                      {TASK_PRIORITY_LABELS[task.priority]}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                  {task.returnCount > 0 && (
                    <span className="text-red-500">Returned {task.returnCount}x</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
