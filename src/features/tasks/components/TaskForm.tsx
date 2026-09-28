import { useState, useEffect, useMemo } from 'react';
import { createTask, updateTask, getTask } from '../services/taskService';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/shared/components/ui/Button';
import type { CreateTaskPayload, UpdateTaskPayload, Task, TaskPriority } from '../types';
import { TASK_PRIORITY_LABELS } from '../types';
import { parseDateInputToEndOfDay, formatDueDateForInput } from '../utils/taskUtils';

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

interface TaskFormState {
  title: string;
  description: string;
  selectedTraineeId: string;
  priority: TaskPriority;
  dueDate: string;
  estimatedHours: string;
  requireAttachment: boolean;
}

export function TaskForm({ taskId, traineeId: initialTraineeId, companyId, onSaved, onCancel }: TaskFormProps) {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trainees, setTrainees] = useState<TraineeOption[]>([]);
  const [initialState, setInitialState] = useState<TaskFormState | null>(null);

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

        const traineeData = snap.docs.map((d) => ({
          id: d.id,
          name: (d.data().name as string) || '',
          userId: d.data().userId as string,
        }));

        const fallback = traineeData.map((t) => ({ id: t.id, name: t.name || 'Trainee' }));
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
            const u = doc.data();
            userMap.set(doc.id, (u.displayName as string) || (u.name as string) || (u.email as string) || 'Trainee');
          });
        }
        if (cancelled) return;

        const resolved = traineeData.map((t) => ({
          id: t.id,
          name: t.name || userMap.get(t.userId) || 'Trainee',
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
            const formattedDueDate = formatDueDateForInput(task.dueDate);
            const estHours = task.estimatedHours?.toString() || '';
            setTitle(task.title);
            setDescription(task.description);
            setSelectedTraineeId(task.traineeId);
            setPriority(task.priority);
            setDueDate(formattedDueDate);
            setEstimatedHours(estHours);
            setRequireAttachment(task.requireAttachment);

            setInitialState({
              title: task.title,
              description: task.description,
              selectedTraineeId: task.traineeId,
              priority: task.priority,
              dueDate: formattedDueDate,
              estimatedHours: estHours,
              requireAttachment: task.requireAttachment,
            });
          }
        })
        .finally(() => setLoading(false));
    }
  }, [taskId]);

  const isDirty = useMemo(() => {
    if (!taskId) return true;
    if (!initialState) return false;
    return (
      title.trim() !== initialState.title.trim() ||
      description.trim() !== initialState.description.trim() ||
      selectedTraineeId !== initialState.selectedTraineeId ||
      priority !== initialState.priority ||
      dueDate !== initialState.dueDate ||
      estimatedHours.trim() !== initialState.estimatedHours.trim() ||
      requireAttachment !== initialState.requireAttachment
    );
  }, [taskId, initialState, title, description, selectedTraineeId, priority, dueDate, estimatedHours, requireAttachment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // If editing and no changes were made, close gracefully without redundant Firestore write
    if (taskId && !isDirty) {
      onCancel?.();
      return;
    }

    setLoading(true);

    try {
      if (!title.trim()) throw new Error('Title is required');
      if (!description.trim()) throw new Error('Description is required');
      if (!selectedTraineeId) throw new Error('Select a trainee');
      if (!dueDate) throw new Error('Due date is required');

      const dueDateMs = parseDateInputToEndOfDay(dueDate);

      if (taskId) {
        const selectedTrainee = trainees.find((t) => t.id === selectedTraineeId);
        const payload: UpdateTaskPayload = {
          title: title.trim(),
          description: description.trim(),
          traineeId: selectedTraineeId || undefined,
          traineeName: selectedTrainee?.name || undefined,
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
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
          disabled={Boolean(taskId && !isDirty)}
        >
          {taskId ? 'Save Changes' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
}

