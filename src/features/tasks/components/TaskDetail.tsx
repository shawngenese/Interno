import { useState, useEffect } from 'react';
import { getTask, getTaskApprovals, submitTask, reviewTask, addComment, getComments } from '../services/taskService';
import { useAuth } from '@/features/auth/AuthProvider';
import { TaskForm } from './TaskForm';
import { formatDateTime12 } from '@/shared/utils/dateUtils';
import type { Task, TaskApproval, SubmitTaskPayload, ReviewTaskPayload, TaskComment } from '../types';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_COLORS, TASK_PRIORITY_COLORS } from '../types';

interface TaskDetailProps {
  taskId: string;
  onBack?: () => void;
}

export function TaskDetail({ taskId }: TaskDetailProps) {
  const { user, role } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [approvals, setApprovals] = useState<TaskApproval[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [traineeUserId, setTraineeUserId] = useState<string | null>(null);

  const [submitText, setSubmitText] = useState('');
  const [submitFiles, setSubmitFiles] = useState<File[]>([]);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentFiles, setCommentFiles] = useState<File[]>([]);

  const loadTask = async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, a, c] = await Promise.all([getTask(taskId), getTaskApprovals(taskId), getComments(taskId)]);
      setTask(t);
      setApprovals(a);
      setComments(c);

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
  }, [taskId]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const attachmentUrls: string[] = [];
      const payload: SubmitTaskPayload = { text: submitText, attachments: attachmentUrls };
      await submitTask(taskId, payload);
      setSubmitText('');
      setSubmitFiles([]);
      await loadTask();
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

  const handleAddComment = async () => {
    if (!user) return;
    if (!commentText.trim() && commentFiles.length === 0) return;
    setSubmitting(true);
    try {
      const attachmentUrls: string[] = [];
      await addComment(taskId, commentText, user!.uid, attachmentUrls);
      setCommentText('');
      setCommentFiles([]);
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
  const isOverdue = task.dueDate < Date.now() && task.status !== 'approved';

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
            <label className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">Attachments</label>
            <input
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

      {/* Comments Section */}
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <h3 className="text-lg font-semibold text-[#121212] dark:text-white mb-4">
          Comments
          {comments.length > 0 && (
            <span className="ml-2 text-sm font-normal text-[#757575] dark:text-[#9E9E9E]">({comments.length})</span>
          )}
        </h3>

        <div className="space-y-3 mb-4">
          {comments.length === 0 ? (
            <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">No comments yet.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="p-3 bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[#3A3A3A] dark:text-[#BDBDBD]">
                    {c.userId === user?.uid ? 'You' : c.userId.slice(0, 8) + '...'}
                  </span>
                  <span className="text-xs text-[#757575] dark:text-[#9E9E9E]">
                    {formatDateTime12(c.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-[#3A3A3A] dark:text-[#BDBDBD] whitespace-pre-wrap">{c.text}</p>
                {c.attachments && c.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.attachments.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 underline">
                        Attachment {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-[#D5D5D5] dark:border-[#3A3A3A] pt-4">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={2}
            placeholder="Add a comment..."
            aria-label="Add a comment"
            className="w-full px-4 py-2.5 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3"
          />
          <div className="flex items-center justify-between">
            <input
              type="file"
              multiple
              onChange={(e) => setCommentFiles(Array.from(e.target.files || []))}
              className="text-sm text-[#757575] dark:text-[#9E9E9E] file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-[#EFEFEF] file:text-[#3A3A3A] dark:file:bg-[#3A3A3A] dark:file:text-[#BDBDBD] hover:file:bg-[#D5D5D5]"
            />
            <button
              onClick={handleAddComment}
              disabled={submitting || (!commentText.trim() && commentFiles.length === 0)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Comment'}
            </button>
          </div>
        </div>
      </div>

      {approvals.length > 0 && (
        <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
          <h3 className="text-lg font-semibold text-[#121212] dark:text-white mb-4">Approval History</h3>
          <div className="space-y-3">
            {approvals.map((a) => (
              <div key={a.id} className={`p-3 rounded-lg border ${
                a.action === 'approved'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${
                    a.action === 'approved' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                  }`}>
                    {a.action === 'approved' ? 'Approved' : 'Returned'}
                  </span>
                  <span className="text-xs text-[#757575] dark:text-[#9E9E9E]">
                    {formatDateTime12(a.timestamp)}
                  </span>
                </div>
                {a.feedback && (
                  <p className="mt-1 text-sm text-[#555555] dark:text-[#9E9E9E]">{a.feedback}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
