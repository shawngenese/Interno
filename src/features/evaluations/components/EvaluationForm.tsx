import { useState } from 'react';
import { evaluationService } from '../services/evaluationService';
import { useAuth } from '@/features/auth';
import { EVALUATION_CATEGORIES, EVALUATION_TYPE_LABELS, RATING_LABELS } from '../types';
import type { EvaluationType, EvaluationRating, RatingScale } from '../types';

interface EvaluationFormProps {
  traineeId: string;
  traineeName: string;
  companyId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EvaluationForm({
  traineeId,
  traineeName,
  companyId,
  onSuccess,
  onCancel,
}: EvaluationFormProps) {
  const { user } = useAuth();
  const [type, setType] = useState<EvaluationType>('monthly');
  const [ratings, setRatings] = useState<EvaluationRating[]>(
    EVALUATION_CATEGORIES.map(category => ({
      category,
      rating: 3 as RatingScale,
      comments: '',
    }))
  );
  const [overallComments, setOverallComments] = useState('');
  const [periodStart, setPeriodStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRatingChange = (index: number, rating: RatingScale) => {
    setRatings(prev => prev.map((r, i) => i === index ? { ...r, rating } : r));
  };

  const handleCommentsChange = (index: number, comments: string) => {
    setRatings(prev => prev.map((r, i) => i === index ? { ...r, comments } : r));
  };

  const calculateOverallRating = () => {
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / ratings.length) * 10) / 10;
  };

  const handleSave = async (asDraft: boolean = true) => {
    if (!user) return;
    setSaving(true);
    setError(null);

    try {
      const overallRating = calculateOverallRating();
      await evaluationService.createEvaluation({
        traineeId,
        traineeName,
        supervisorId: user.uid,
        supervisorName: user.displayName || user.email || 'Unknown',
        companyId,
        type,
        status: asDraft ? 'draft' : 'submitted',
        period: {
          startDate: new Date(periodStart).getTime(),
          endDate: new Date(periodEnd).getTime(),
        },
        ratings,
        overallComments,
        overallRating,
      });
      onSuccess?.();
    } catch (err) {
      setError('Failed to save evaluation');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
      <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        <h3 className="text-lg font-semibold text-[#121212] dark:text-white">
          New Evaluation for {traineeName}
        </h3>
      </div>

      <div className="p-4 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="evaluation-type" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              Evaluation Type
            </label>
            <select
              id="evaluation-type"
              value={type}
              onChange={(e) => setType(e.target.value as EvaluationType)}
              className="w-full px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(EVALUATION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="period-start" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              Period Start
            </label>
            <input
              id="period-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="period-end" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              Period End
            </label>
            <input
              id="period-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-[#121212] dark:text-white">Ratings</h4>
          {ratings.map((item, index) => (
            <div key={item.category} className="p-4 bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-[#121212] dark:text-white">{item.category}</span>
                <span className="text-sm text-[#757575] dark:text-[#9E9E9E]">
                  {RATING_LABELS[item.rating]}
                </span>
              </div>
              <div className="flex gap-2 mb-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleRatingChange(index, value as RatingScale)}
                    className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                      item.rating === value
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-[#555555] text-[#3A3A3A] dark:text-[#BDBDBD] hover:bg-[#EFEFEF] dark:hover:bg-[#757575]'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={item.comments || ''}
                onChange={(e) => handleCommentsChange(index, e.target.value)}
                placeholder="Optional comments..."
                className="w-full px-3 py-2 text-sm border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#1E1E1E] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          ))}
        </div>

        <div>
          <label htmlFor="overall-comments" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
            Overall Comments
          </label>
          <textarea
            id="overall-comments"
            value={overallComments}
            onChange={(e) => setOverallComments(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Provide overall comments about the trainee's performance..."
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A]">
          <div className="text-sm text-[#757575] dark:text-[#9E9E9E]">
            Overall Rating: <span className="font-semibold text-[#121212] dark:text-white">{calculateOverallRating()}</span>/5
          </div>
          <div className="flex gap-3">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
