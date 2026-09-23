import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getTraineeTasks, getTraineeTaskCounts } from '../services/taskService';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { TaskDetail } from './TaskDetail';
import { EmptyState } from '@/shared/components/EmptyState';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { CheckSquare, Clock, ArrowLeft } from 'lucide-react';
import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS, TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS } from '../types';

const getDueMs = (d: unknown): number => {
  if (!d) return Infinity;
  if (typeof d === 'number') return d;
  if (d instanceof Date) return d.getTime();
  if (typeof d === 'object' && d !== null && 'toMillis' in d) return (d as { toMillis: () => number }).toMillis();
  return Infinity;
};

export function MyTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState<Record<TaskStatus, number>>({
    pending: 0,
    in_progress: 0,
    submitted: 0,
    approved: 0,
    returned: 0,
    archived: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [traineeId, setTraineeId] = useState<string | null>(null);
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (!user?.uid || resolvedRef.current) return;
    const resolveTrainee = async () => {
      try {
        const db = getFirestoreInstancePublic();
        const traineeSnap = await getDocs(
          query(collection(db, 'trainees'), where('userId', '==', user.uid), where('status', '==', 'active'))
        );
        if (!traineeSnap.empty) {
          setTraineeId(traineeSnap.docs[0].id);
        }
        resolvedRef.current = true;
      } catch (err) {
        console.error('Failed to resolve trainee ID:', err);
        resolvedRef.current = true;
      }
    };
    resolveTrainee();
  }, [user?.uid]);

  const fetchTasks = useCallback(async () => {
    if (!user?.uid || !traineeId) return;
    setLoading(true);
    try {
      const [allTasks, taskCounts] = await Promise.all([
        getTraineeTasks(traineeId),
        getTraineeTaskCounts(traineeId),
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

  const [now] = useState(() => Date.now());

  if (selectedTask) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setSelectedTask(null); fetchTasks(); }}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to My Tasks
        </Button>
        <TaskDetail taskId={selectedTask.id} onBack={() => { setSelectedTask(null); fetchTasks(); }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CheckSquare className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">My Tasks</h2>
      </div>

      {/* Filter Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(['pending', 'in_progress', 'submitted', 'approved', 'returned'] as TaskStatus[]).map((status) => {
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={`p-3 rounded-xl border text-center transition-colors bg-card ${
                isActive
                  ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <p className={`text-2xl font-bold ${TASK_STATUS_COLORS[status].text}`}>{counts[status]}</p>
              <p className="text-xs font-semibold text-muted-foreground mt-1">{TASK_STATUS_LABELS[status]}</p>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={80} className="rounded-xl" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          title={statusFilter === 'all' ? 'No tasks assigned yet' : `No ${TASK_STATUS_LABELS[statusFilter].toLowerCase()} tasks`}
          description={statusFilter === 'all' ? 'Tasks assigned to you will appear here.' : 'Try a different filter status above.'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredTasks.map((task) => {
            const isOverdue = getDueMs(task.dueDate) < now && task.status !== 'approved';
            return (
              <button
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="w-full text-left bg-card rounded-xl shadow-sm border border-border p-4 hover:border-primary transition-colors space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground text-sm truncate">{task.title}</h3>
                      {isOverdue && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-destructive/15 text-destructive rounded border border-destructive/20">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${TASK_STATUS_COLORS[task.status].bg} ${TASK_STATUS_COLORS[task.status].text}`}>
                      {TASK_STATUS_LABELS[task.status]}
                    </span>
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${TASK_PRIORITY_COLORS[task.priority].bg} ${TASK_PRIORITY_COLORS[task.priority].text}`}>
                      {TASK_PRIORITY_LABELS[task.priority]}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Due: {new Date(getDueMs(task.dueDate)).toLocaleDateString()}</span>
                  </div>
                  {task.returnCount > 0 && (
                    <span className="text-destructive font-semibold">Returned {task.returnCount}x</span>
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

