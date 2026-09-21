import { useState, useEffect } from 'react';
import { getTask, submitTask, reviewTask } from '../services/taskService';
import { useAuth } from '@/features/auth/AuthProvider';
import { getStorageInstancePublic } from '@/config/firebase';
import { TaskForm } from './TaskForm';
import { formatDateTime12 } from '@/shared/utils/dateUtils';
import type { Task, SubmitTaskPayload, ReviewTaskPayload } from '../types';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_COLORS, TASK_PRIORITY_COLORS } from '../types';

interface TaskDetailProps {
  taskId: string;
  onBack?: () => void;
}

export function TaskDetail({ taskId }: TaskDetailProps) {
  const { user, role } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [traineeUserId, setTraineeUserId] = useState<string | null>(null);

  const [submitText, setSubmitText] = useState('');
  const [submitFiles, setSubmitFiles] = useState<File[]>([]);
  const [reviewFeedback, setReviewFeedback] = useState('');

  const loadTask = async () => {
    setLoading(true);
    setError(null);
    try {
      const t = await getTask(taskId);
      setTask(t);

      if (t?.traineeId) {
        const { getFirestoreInstancePublic } = await import('@/config/firebase');
        const { doc, getDoc } = await import('firebase/firestore');
        const db = getFirestoreInstancePublic();
        const traineeSnap = await getDoc(doc(db, 'trainees', t.traineeId));
        setTraineeUserId(traineeSnap.exists() ? traineeSnap.data().userId : null);
      }
    } catch (err) {
      console.error('Failed to load task:', err);
      setError('Failed to load task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const [now] = useState(() => Date.now());

  const uploadFiles = async (files: File[], companyId: string): Promise<string[]> => {
    if (files.length === 0) return [];
    const storage = getStorageInstancePublic();
    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const urls: string[] = [];
    for (const file of files) {
      const path = `tasks/${companyId}/${taskId}/submissions/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      urls.push(url);
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (task?.requireAttachment && submitFiles.length === 0) {
      alert('This task requires at least one file attachment.');
      return;
    }
    setSubmitting(true);
    try {
      const attachmentUrls = await uploadFiles(submitFiles, task?.companyId || '');
      const payload: SubmitTaskPayload = { text: submitText, attachments: attachmentUrls };
      await submitTask(taskId, payload);
      setSubmitText('');
      setSubmitFiles([]);
      await loadTask();
    } catch (err) {
      console.error('Failed to submit task:', err);
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (action: 'approved' | 'returned') => {
    setSubmitting(true);
    try {
      const payload: ReviewTaskPayload = { action, feedback: reviewFeedback || undefined };
      await reviewTask(taskId, payload);
      setReviewFeedback('');
      await loadTask();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!task && !error) {
    return (
      <div className="text-center py-12 bg-white dark:bg-[#1E1E1E] rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A]">
        <p className="text-[#757575] dark:text-[#9E9E9E]">Task not found.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-white dark:bg-[#1E1E1E] rounded-xl border border-[#D5D5D5] dark:border-[#3A3A3A]">
        <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
        <button
          onClick={loadTask}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!task) return null;

  const isSupervisor = traineeUserId
    ? user?.uid !== traineeUserId
    : role === 'supervisor' || role === 'admin';
  const isOverdue = task.dueDate < now && task.status !== 'approved';

  if (editing) {
    return (
      <div className="space-y-4">
        <button onClick={() => setEditing(false)} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700">
          ← Cancel editing
        </button>
        <TaskForm taskId={taskId} onSaved={() => { setEditing(false); loadTask(); }} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-xl font-semibold text-[#121212] dark:text-white">{task.title}</h2>
              {isOverdue && (
                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                  Overdue
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-[#757575] dark:text-[#9E9E9E]">
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TASK_STATUS_COLORS[task.status].bg} ${TASK_STATUS_COLORS[task.status].text}`}>
                {TASK_STATUS_LABELS[task.status]}
              </span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TASK_PRIORITY_COLORS[task.priority].bg} ${TASK_PRIORITY_COLORS[task.priority].text}`}>
                {TASK_PRIORITY_LABELS[task.priority]}
              </span>
              <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
              {task.estimatedHours && <span>Est. {task.estimatedHours}h</span>}
            </div>
          </div>
          {isSupervisor && task.status === 'pending' && (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-[#EFEFEF] dark:bg-[#3A3A3A] rounded-lg hover:bg-[#D5D5D5] dark:hover:bg-[#555555]"
            >
              Edit
            </button>
          )}
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
          <p className="text-[#3A3A3A] dark:text-[#BDBDBD] whitespace-pre-wrap">{task.description}</p>
        </div>

        {task.submission && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Trainee Submission</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 whitespace-pre-wrap">{task.submission.text}</p>
            {task.submission.attachments && task.submission.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {task.submission.attachments.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 underline">
                    Attachment {i + 1}
                  </a>
                ))}
              </div>
            )}
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              Submitted: {formatDateTime12(task.submission.submittedAt)}
            </p>
          </div>
        )}

        {task.feedback && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">Supervisor Feedback</h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 whitespace-pre-wrap">{task.feedback}</p>
          </div>
        )}
      </div>

      {task.status === 'submitted' && isSupervisor && (
        <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
          <h3 className="text-lg font-semibold text-[#121212] dark:text-white mb-4">Review Submission</h3>
          <textarea
            value={reviewFeedback}
            onChange={(e) => setReviewFeedback(e.target.value)}
            rows={3}
            placeholder="Add feedback (optional)..."
            aria-label="Review feedback"
            className="w-full px-4 py-2.5 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"
          />
          <div className="flex gap-3">
            <button
              onClick={() => handleReview('approved')}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Approve'}
            </button>
            <button
              onClick={() => handleReview('returned')}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Return for Revision'}
            </button>
          </div>
        </div>
      )}

      {(task.status === 'pending' || task.status === 'in_progress' || task.status === 'returned') && !isSupervisor && (
        <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
          <h3 className="text-lg font-semibold text-[#121212] dark:text-white mb-4">Submit Work</h3>
          <textarea
            value={submitText}
            onChange={(e) => setSubmitText(e.target.value)}
            rows={4}
            placeholder="Describe your progress or paste your work..."
            aria-label="Describe your progress"
            className="w-full px-4 py-2.5 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3"
          />
          <div className="mb-4">
            <label htmlFor="attachment-input" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              Attachments{task?.requireAttachment ? <span className="text-red-500 ml-1">(Required)</span> : <span className="text-[#757575] dark:text-[#9E9E9E] ml-1">(Optional)</span>}
            </label>
            <input
              id="attachment-input"
              type="file"
              multiple
              onChange={(e) => setSubmitFiles(Array.from(e.target.files || []))}
              className="w-full text-sm text-[#757575] dark:text-[#9E9E9E] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300 hover:file:bg-blue-100"
            />
            {submitFiles.length > 0 && (
              <p className="mt-1 text-xs text-[#757575] dark:text-[#9E9E9E]">{submitFiles.length} file(s) selected</p>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit for Review'}
          </button>
        </div>
      )}


    </div>
  );
}
