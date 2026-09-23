import { useState, useEffect } from 'react';
import { createTask, updateTask, getTask } from '../services/taskService';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/shared/components/ui/Button';
import { CheckSquare } from 'lucide-react';
import type { CreateTaskPayload, UpdateTaskPayload, Task, TaskPriority } from '../types';
import { TASK_PRIORITY_LABELS } from '../types';

interface TaskFormProps {
  taskId?: string;
  traineeId?: string;
  companyId?: string;
  onSaved?: (task: Task) => void;
  onCancel?: () => void;
}

interface TraineeOption {
  id: string;
  name: string;
}

export function TaskForm({ taskId, traineeId: initialTraineeId, companyId, onSaved, onCancel }: TaskFormProps) {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trainees, setTrainees] = useState<TraineeOption[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTraineeId, setSelectedTraineeId] = useState(initialTraineeId || '');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [requireAttachment, setRequireAttachment] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadTrainees() {
      if (!user?.uid) return;
      try {
        const db = getFirestoreInstancePublic();
        const traineeConstraints = [where('status', '==', 'active')];
        if (role === 'supervisor') {
          traineeConstraints.push(where('supervisorId', '==', user.uid));
        }
        const snap = await getDocs(
          query(collection(db, 'trainees'), ...traineeConstraints)
        );
        if (cancelled) return;

        const traineeData = snap.docs.map((d) => ({ id: d.id, userId: d.data().userId as string }));

        const fallback = traineeData.map((t) => ({ id: t.id, name: t.userId || t.id }));
        setTrainees(fallback);

        const userIds = [...new Set(traineeData.map((t) => t.userId).filter(Boolean))];
        if (userIds.length === 0) return;

        const userMap = new Map<string, string>();
        const FIRESTORE_IN_LIMIT = 30;
        for (let i = 0; i < userIds.length; i += FIRESTORE_IN_LIMIT) {
          const chunk = userIds.slice(i, i + FIRESTORE_IN_LIMIT);
          const userSnap = await getDocs(
            query(collection(db, 'users'), where('__name__', 'in', chunk))
          );
          userSnap.docs.forEach((doc) => {
            userMap.set(doc.id, doc.data().displayName || doc.data().email || doc.id);
          });
        }
        if (cancelled) return;

        const resolved = traineeData.map((t) => ({
          id: t.id,
          name: userMap.get(t.userId) || t.userId || t.id,
        }));
        setTrainees(resolved);
      } catch (err) {
        console.error('Failed to load trainees:', err);
      }
    }
    loadTrainees();
    return () => { cancelled = true; };
  }, [user?.uid, role]);

  useEffect(() => {
    if (taskId) {
      setLoading(true);
      getTask(taskId)
        .then((task) => {
          if (task) {
            setTitle(task.title);
            setDescription(task.description);
            setSelectedTraineeId(task.traineeId);
            setPriority(task.priority);
            setDueDate(new Date(task.dueDate).toISOString().split('T')[0]);
            setEstimatedHours(task.estimatedHours?.toString() || '');
            setRequireAttachment(task.requireAttachment);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [taskId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!title.trim()) throw new Error('Title is required');
      if (!description.trim()) throw new Error('Description is required');
      if (!selectedTraineeId) throw new Error('Select a trainee');
      if (!dueDate) throw new Error('Due date is required');

      const dueDateMs = new Date(dueDate).getTime();

      if (taskId) {
        const payload: UpdateTaskPayload = {
          title: title.trim(),
          description: description.trim(),
          priority,
          dueDate: dueDateMs,
          estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
          requireAttachment,
        };
        await updateTask(taskId, payload);
        const updated = await getTask(taskId);
        if (updated) onSaved?.(updated);
      } else {
        const payload: CreateTaskPayload = {
          title: title.trim(),
          description: description.trim(),
          traineeId: selectedTraineeId,
          companyId: companyId || '',
          priority,
          dueDate: dueDateMs,
          estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
          requireAttachment,
        };
        const created = await createTask(payload);
        onSaved?.(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
      <div className="flex items-center gap-2 mb-6">
        <CheckSquare className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">
          {taskId ? 'Edit Task' : 'Create Task'}
        </h2>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-xs font-semibold text-foreground mb-1.5">
            Title *
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-10 px-4 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Task title"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-xs font-semibold text-foreground mb-1.5">
            Description *
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full p-3 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="Describe the task instructions..."
          />
        </div>

        {!initialTraineeId && (
          <div>
            <label htmlFor="trainee" className="block text-xs font-semibold text-foreground mb-1.5">
              Assign to Trainee *
            </label>
            <select
              id="trainee"
              value={selectedTraineeId}
              onChange={(e) => setSelectedTraineeId(e.target.value)}
              className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a trainee</option>
              {trainees.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="priority" className="block text-xs font-semibold text-foreground mb-1.5">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dueDate" className="block text-xs font-semibold text-foreground mb-1.5">
              Due Date *
            </label>
            <input
              type="date"
              id="dueDate"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="hours" className="block text-xs font-semibold text-foreground mb-1.5">
              Est. Hours
            </label>
            <input
              type="number"
              id="hours"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              min="0"
              step="0.5"
              className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="requireAttachment"
            checked={requireAttachment}
            onChange={(e) => setRequireAttachment(e.target.checked)}
            className="w-4 h-4 text-primary border-input rounded focus:ring-ring focus:ring-2"
          />
          <label htmlFor="requireAttachment" className="text-xs text-foreground cursor-pointer">
            Require file attachment on submission
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          isLoading={loading}
        >
          Save
        </Button>
      </div>
    </form>
  );
}

