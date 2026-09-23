import { useState } from 'react';
import { evaluationService } from '../services/evaluationService';
import { useAuth } from '@/features/auth';
import { Button } from '@/shared/components/ui/Button';
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
    <div className="bg-card rounded-xl shadow-sm border border-border">
      <div className="p-4 md:p-6 border-b border-border">
        <h3 className="text-base font-bold text-foreground">
          New Evaluation for {traineeName}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Rate key competencies and provide constructive feedback</p>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {error && (
          <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="evaluation-type" className="block text-xs font-semibold text-foreground mb-1.5">
              Evaluation Type
            </label>
            <select
              id="evaluation-type"
              value={type}
              onChange={(e) => setType(e.target.value as EvaluationType)}
              className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {Object.entries(EVALUATION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="period-start" className="block text-xs font-semibold text-foreground mb-1.5">
              Period Start
            </label>
            <input
              id="period-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="period-end" className="block text-xs font-semibold text-foreground mb-1.5">
              Period End
            </label>
            <input
              id="period-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-bold text-foreground text-sm">Competency Ratings</h4>
          {ratings.map((item, index) => (
            <div key={item.category} className="p-4 bg-muted/40 rounded-xl border border-border space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="font-semibold text-foreground text-sm">{item.category}</span>
                <span className="text-xs text-muted-foreground font-medium">
                  {item.rating}/5 — {RATING_LABELS[item.rating]}
                </span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleRatingChange(index, value as RatingScale)}
                    className={`min-w-[44px] h-11 rounded-lg text-sm font-bold transition-colors ${
                      item.rating === value
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-card border border-border text-foreground hover:bg-muted'
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
                placeholder="Optional comments for this category..."
                className="w-full h-10 px-3 text-xs border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
        </div>

        <div>
          <label htmlFor="overall-comments" className="block text-xs font-semibold text-foreground mb-1.5">
            Overall Comments
          </label>
          <textarea
            id="overall-comments"
            value={overallComments}
            onChange={(e) => setOverallComments(e.target.value)}
            rows={4}
            className="w-full p-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            placeholder="Provide overall comments and recommendations for the trainee..."
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-3 pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Overall Calculated Score: <span className="font-bold text-foreground text-base">{calculateOverallRating()}</span> / 5.0
          </div>
          <div className="flex items-center justify-end gap-2.5">
            {onCancel && (
              <Button
                variant="secondary"
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="secondary"
              isLoading={saving}
              onClick={() => handleSave(true)}
            >
              Save Draft
            </Button>
            <Button
              variant="primary"
              isLoading={saving}
              onClick={() => handleSave(false)}
            >
              Submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
