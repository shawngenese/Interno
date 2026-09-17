import { useState, useEffect } from 'react';
import { evaluationService } from '../services/evaluationService';
import { EVALUATION_CATEGORIES, EVALUATION_TYPE_LABELS, RATING_LABELS } from '../types';
import type { Evaluation, EvaluationStatus } from '../types';
import { useAuth } from '@/features/auth';

interface EvaluationReviewProps {
  evaluationId: string;
  onClose: () => void;
}

export function EvaluationReview({ evaluationId, onClose }: EvaluationReviewProps) {
  const { user } = useAuth();
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewComments, setReviewComments] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEvaluation();
  }, [evaluationId]);

  const loadEvaluation = async () => {
    try {
      const data = await evaluationService.getEvaluation(evaluationId);
      setEvaluation(data);
      setReviewComments(data.reviewComments || '');
    } catch (error) {
      console.error('Failed to load evaluation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (action: 'review' | 'finalize') => {
    if (!user || !evaluation) return;
    setSaving(true);

    try {
      if (action === 'review') {
        await evaluationService.reviewEvaluation(evaluation.id, user.uid, reviewComments);
      } else {
        await evaluationService.finalizeEvaluation(evaluation.id, user.uid);
      }
      onClose();
    } catch (error) {
      console.error('Failed to update evaluation:', error);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: EvaluationStatus) => {
    const badges: Record<EvaluationStatus, string> = {
      draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      reviewed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      finalized: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    };
    return badges[status];
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-gray-500 dark:text-gray-400">Evaluation not found</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Evaluation for {evaluation.traineeName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {EVALUATION_TYPE_LABELS[evaluation.type]} • Submitted by {evaluation.supervisorName}
            </p>
          </div>
          <span className={`px-3 py-1 text-sm rounded-full ${getStatusBadge(evaluation.status)}`}>
            {evaluation.status.charAt(0).toUpperCase() + evaluation.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Period:</span>
            <p className="font-medium text-gray-900 dark:text-white">
              {new Date(evaluation.period.startDate).toLocaleDateString()} - {new Date(evaluation.period.endDate).toLocaleDateString()}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Overall Rating:</span>
            <p className="font-medium text-gray-900 dark:text-white">
              {evaluation.overallRating}/5
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-gray-900 dark:text-white">Category Ratings</h4>
          {evaluation.ratings.map((item) => {
            const category = EVALUATION_CATEGORIES.find((c) => c === item.category);
            if (!category) return null;
            return (
              <div key={item.category} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {RATING_LABELS[item.rating]}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {item.rating}/5
                    </span>
                  </div>
                </div>
                {item.comments && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{item.comments}</p>
                )}
              </div>
            );
          })}
        </div>

        {evaluation.overallComments && (
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Supervisor Comments</h4>
            <p className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
              {evaluation.overallComments}
            </p>
          </div>
        )}

        {evaluation.status === 'submitted' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Coordinator Review Comments
            </label>
            <textarea
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add your review comments..."
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Close
          </button>
          {evaluation.status === 'submitted' && (
            <>
              <button
                onClick={() => handleReview('review')}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-yellow-600 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Mark Reviewed'}
              </button>
              <button
                onClick={() => handleReview('finalize')}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Finalize'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
