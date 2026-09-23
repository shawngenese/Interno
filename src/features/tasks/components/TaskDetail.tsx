import { useState, useEffect } from 'react';
import { getTask, submitTask, reviewTask } from '../services/taskService';
import { useAuth } from '@/features/auth/AuthProvider';
import { getStorageInstancePublic } from '@/config/firebase';
import { TaskForm } from './TaskForm';
import { formatDateTime12 } from '@/shared/utils/dateUtils';
import { AlertModal } from '@/shared/components/AlertModal';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { CheckCircle2, Clock, MessageSquare, Paperclip, Send, Edit, ArrowLeft, Upload } from 'lucide-react';
import type { Task, SubmitTaskPayload, ReviewTaskPayload } from '../types';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_COLORS, TASK_PRIORITY_COLORS } from '../types';

interface TaskDetailProps {
  taskId: string;
  onBack?: () => void;
}

export function TaskDetail({ taskId, onBack }: TaskDetailProps) {
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
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);

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
      setAlertModal({ title: 'Error', message: 'This task requires at least one file attachment.' });
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
      setAlertModal({ title: 'Error', message: 'Failed to submit. Please try again.' });
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
      <div className="space-y-4">
        <Skeleton variant="rectangular" height={200} className="rounded-xl" />
        <Skeleton variant="rectangular" height={150} className="rounded-xl" />
      </div>
    );
  }

  if (!task && !error) {
    return (
      <div className="text-center py-12 bg-card rounded-xl border border-border p-6">
        <p className="text-sm text-muted-foreground">Task not found.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-card rounded-xl border border-border p-6">
        <p className="text-sm text-destructive mb-4">{error}</p>
        <Button variant="primary" onClick={loadTask}>
          Retry
        </Button>
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
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Cancel editing
        </Button>
        <TaskForm taskId={taskId} onSaved={() => { setEditing(false); loadTask(); }} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to tasks
        </Button>
      )}

      <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h2 className="text-xl font-bold text-foreground">{task.title}</h2>
              {isOverdue && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-destructive/15 text-destructive rounded-full border border-destructive/20">
                  Overdue
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
              <span className={`px-2.5 py-0.5 font-semibold rounded-full ${TASK_STATUS_COLORS[task.status].bg} ${TASK_STATUS_COLORS[task.status].text}`}>
                {TASK_STATUS_LABELS[task.status]}
              </span>
              <span className={`px-2.5 py-0.5 font-semibold rounded-full ${TASK_PRIORITY_COLORS[task.priority].bg} ${TASK_PRIORITY_COLORS[task.priority].text}`}>
                {TASK_PRIORITY_LABELS[task.priority]}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Due: {new Date(task.dueDate).toLocaleDateString()}
              </span>
              {task.estimatedHours && <span>• Est. {task.estimatedHours}h</span>}
            </div>
          </div>
          {isSupervisor && task.status === 'pending' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Edit className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          )}
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{task.description}</p>
        </div>

        {task.submission && (
          <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-bold text-primary uppercase tracking-wide">Trainee Submission</h4>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{task.submission.text}</p>
            {task.submission.attachments && task.submission.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {task.submission.attachments.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline bg-card px-2.5 py-1 rounded-md border border-border"
                  >
                    <Paperclip className="w-3.5 h-3.5" /> Attachment {i + 1}
                  </a>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground pt-1">
              Submitted: {formatDateTime12(task.submission.submittedAt)}
            </p>
          </div>
        )}

        {task.feedback && (
          <div className="mt-4 p-4 bg-warning/10 border border-warning/20 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-warning" />
              <h4 className="text-xs font-bold text-warning uppercase tracking-wide">Supervisor Feedback</h4>
            </div>
            <p className="text-sm text-warning/90 whitespace-pre-wrap">{task.feedback}</p>
          </div>
        )}
      </div>

      {task.status === 'submitted' && isSupervisor && (
        <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6 space-y-4">
          <h3 className="text-base font-bold text-foreground">Review Submission</h3>
          <textarea
            value={reviewFeedback}
            onChange={(e) => setReviewFeedback(e.target.value)}
            rows={3}
            placeholder="Add feedback notes (optional)..."
            aria-label="Review feedback"
            className="w-full p-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="destructive"
              onClick={() => handleReview('returned')}
              isLoading={submitting}
            >
              Return for Revision
            </Button>
            <Button
              variant="primary"
              onClick={() => handleReview('approved')}
              isLoading={submitting}
            >
              Approve
            </Button>
          </div>
        </div>
      )}

      {(task.status === 'pending' || task.status === 'in_progress' || task.status === 'returned') && !isSupervisor && (
        <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6 space-y-4">
          <h3 className="text-base font-bold text-foreground">Submit Work</h3>
          <textarea
            value={submitText}
            onChange={(e) => setSubmitText(e.target.value)}
            rows={4}
            placeholder="Describe your progress or paste deliverables here..."
            aria-label="Describe your progress"
            className="w-full p-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <div>
            <label htmlFor="attachment-input" className="block text-xs font-semibold text-foreground mb-1.5">
              Attachments {task?.requireAttachment ? <span className="text-destructive">* (Required)</span> : <span className="text-muted-foreground">(Optional)</span>}
            </label>
            <div className="relative border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary transition-colors">
              <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1.5" />
              <p className="text-xs text-muted-foreground mb-2">Click or drag files here to attach</p>
              <input
                id="attachment-input"
                type="file"
                multiple
                onChange={(e) => setSubmitFiles(Array.from(e.target.files || []))}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              {submitFiles.length > 0 && (
                <p className="text-xs font-semibold text-primary">{submitFiles.length} file(s) selected</p>
              )}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              onClick={handleSubmit}
              isLoading={submitting}
            >
              <Send className="w-4 h-4 mr-1.5" /> Submit for Review
            </Button>
          </div>
        </div>
      )}

      <AlertModal
        open={alertModal !== null}
        title={alertModal?.title || ''}
        message={alertModal?.message || ''}
        onClose={() => setAlertModal(null)}
      />
    </div>
  );
}

