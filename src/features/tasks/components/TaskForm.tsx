import { useState, useEffect } from 'react';
import { createTask, updateTask, getTask } from '../services/taskService';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
  const { user } = useAuth();
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
    async function loadTrainees() {
      if (!user?.uid) return;
      try {
        const db = getFirestoreInstancePublic();
        const snap = await getDocs(
          query(collection(db, 'trainees'), where('status', '==', 'active'))
        );
        const options = snap.docs.map((d) => {
          const data = d.data();
          return { id: d.id, name: data.name || data.userId || d.id };
        });
        setTrainees(options);

        const userSnap = await getDocs(
          query(collection(db, 'users'), where('role', '==', 'trainee'), where('status', '==', 'active'))
        );
        const userOptions = userSnap.docs.map((d) => {
          const data = d.data();
          return { id: d.id, name: data.displayName || data.email || d.id };
        });

        const merged = new Map<string, TraineeOption>();
        options.forEach((o) => merged.set(o.id, o));
        userOptions.forEach((o) => merged.set(o.id, o));
        setTrainees(Array.from(merged.values()));
      } catch (err) {
        console.error('Failed to load trainees:', err);
      }
    }
    loadTrainees();
  }, [user?.uid]);

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
      if (!selectedTraineeId) throw new Error('Please select a trainee');
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
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        {taskId ? 'Edit Task' : 'Create Task'}
      </h2>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title *
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Task title"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description *
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Describe the task..."
          />
        </div>

        {!initialTraineeId && (
          <div>
            <label htmlFor="trainee" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Assign to Trainee *
            </label>
            <select
              id="trainee"
              value={selectedTraineeId}
              onChange={(e) => setSelectedTraineeId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Due Date *
            </label>
            <input
              type="date"
              id="dueDate"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Est. Hours
            </label>
            <input
              type="number"
              id="hours"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              min="0"
              step="0.5"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="requireAttachment"
            checked={requireAttachment}
            onChange={(e) => setRequireAttachment(e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="requireAttachment" className="text-sm text-gray-700 dark:text-gray-300">
            Require file attachment on submission
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Saving...' : taskId ? 'Update Task' : 'Create Task'}
        </button>
      </div>
    </form>
  );
}
