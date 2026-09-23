import { useState, useEffect } from 'react';
import { evaluationService } from '../services/evaluationService';
import { EVALUATION_CATEGORIES, EVALUATION_TYPE_LABELS, RATING_LABELS } from '../types';
import type { Evaluation, EvaluationStatus } from '../types';
import { useAuth } from '@/features/auth';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { Star, CheckCircle2, ShieldCheck } from 'lucide-react';

interface EvaluationReviewProps {
  evaluationId: string;
  onClose: () => void;
}

export function EvaluationReview({ evaluationId, onClose }: EvaluationReviewProps) {
  const { user, role } = useAuth();
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewComments, setReviewComments] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

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

  useEffect(() => {
    loadEvaluation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluationId]);

  const handleReview = async (action: 'review' | 'finalize') => {
    if (!user || !evaluation) return;
    if (action === 'finalize') {
      setConfirmDialog({
        title: 'Finalize Evaluation',
        message: 'Are you sure you want to finalize this evaluation? This makes the scores official.',
        danger: true,
        onConfirm: async () => {
          setSaving(true);
          try {
            await evaluationService.finalizeEvaluation(evaluation.id, user.uid);
            onClose();
          } catch (error) {
            console.error('Failed to update evaluation:', error);
          } finally {
            setSaving(false);
          }
        },
      });
      return;
    }
    setSaving(true);

    try {
      await evaluationService.reviewEvaluation(evaluation.id, user.uid, reviewComments);
      onClose();
    } catch (error) {
      console.error('Failed to update evaluation:', error);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: EvaluationStatus) => {
    const badges: Record<EvaluationStatus, string> = {
      draft: 'bg-muted text-muted-foreground border-border',
      submitted: 'bg-primary/10 text-primary border-primary/20',
      reviewed: 'bg-warning/10 text-warning border-warning/20',
      finalized: 'bg-success/10 text-success border-success/20',
    };
    return badges[status];
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6 space-y-4">
        <Skeleton variant="text" width="40%" height={28} />
        <Skeleton variant="rectangular" height={100} className="rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangular" height={60} className="rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6 text-center">
        <p className="text-muted-foreground text-sm">Evaluation not found</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border">
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Evaluation for {evaluation.traineeName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {EVALUATION_TYPE_LABELS[evaluation.type]} • Submitted by {evaluation.supervisorName}
            </p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full border capitalize self-start sm:self-auto ${getStatusBadge(evaluation.status)}`}>
            {evaluation.status}
          </span>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 text-sm bg-muted/40 p-4 rounded-xl border border-border">
          <div>
            <span className="text-xs text-muted-foreground">Evaluation Period:</span>
            <p className="font-semibold text-foreground text-sm mt-0.5">
              {new Date(evaluation.period.startDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} – {new Date(evaluation.period.endDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Overall Rating:</span>
            <p className="font-bold text-foreground text-base mt-0.5 flex items-center gap-1">
              <Star className="w-4 h-4 text-warning fill-warning" />
              {evaluation.overallRating} / 5.0
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-bold text-foreground text-sm">Competency Ratings</h4>
          {evaluation.ratings.map((item) => {
            const category = EVALUATION_CATEGORIES.find((c) => c === item.category);
            if (!category) return null;
            return (
              <div key={item.category} className="p-3.5 bg-muted/30 rounded-xl border border-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    {item.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {RATING_LABELS[item.rating]}
                    </span>
                    <span className="font-bold text-foreground text-sm">
                      {item.rating}/5
                    </span>
                  </div>
                </div>
                {item.comments && (
                  <p className="text-xs text-muted-foreground">{item.comments}</p>
                )}
              </div>
            );
          })}
        </div>

        {evaluation.overallComments && (
          <div>
            <h4 className="font-bold text-foreground text-sm mb-2">Supervisor Comments</h4>
            <p className="text-sm text-foreground bg-muted/40 p-3.5 rounded-xl border border-border">
              {evaluation.overallComments}
            </p>
          </div>
        )}

        {evaluation.status === 'submitted' && (role === 'coordinator' || role === 'admin') && (
          <div>
            <label htmlFor="review-comments" className="block text-xs font-semibold text-foreground mb-1.5">
              Coordinator Review Comments
            </label>
            <textarea
              id="review-comments"
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
              rows={3}
              className="w-full p-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              placeholder="Add your review comments or feedback before marking reviewed..."
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-border">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Close
          </Button>
          {evaluation.status === 'submitted' && (role === 'coordinator' || role === 'admin') && (
            <>
              <Button
                variant="secondary"
                isLoading={saving}
                onClick={() => handleReview('review')}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Mark Reviewed
              </Button>
              <Button
                variant="primary"
                isLoading={saving}
                onClick={() => handleReview('finalize')}
              >
                <ShieldCheck className="w-4 h-4 mr-1.5" />
                Finalize
              </Button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        danger={confirmDialog?.danger}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
