import { useState, useEffect } from 'react';
import { evaluationService } from '../services/evaluationService';
import { EVALUATION_TYPE_LABELS, RATING_LABELS } from '../types';
import type { Evaluation } from '../types';
import { Skeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { Star, ChevronDown, ChevronUp } from 'lucide-react';

interface TraineeEvaluationViewProps {
  traineeId: string;
}

export function TraineeEvaluationView({ traineeId }: TraineeEvaluationViewProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);

  const loadEvaluations = async () => {
    try {
      const data = await evaluationService.getTraineeEvaluations(traineeId);
      setEvaluations(data);
    } catch (error) {
      console.error('Failed to load evaluations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvaluations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traineeId]);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground border-border',
      submitted: 'bg-primary/10 text-primary border-primary/20',
      reviewed: 'bg-warning/10 text-warning border-warning/20',
      finalized: 'bg-success/10 text-success border-success/20',
    };
    return badges[status] || 'bg-muted text-muted-foreground border-border';
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rectangular" height={80} className="rounded-xl" />
        ))}
      </div>
    );
  }

  if (evaluations.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <EmptyState
          title="No evaluations yet"
          description="Your supervisor has not submitted any evaluations yet. Check back after your evaluation cycle."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-foreground">
            My Evaluations
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">View your performance reviews and feedback from your supervisor</p>
        </div>

        <div className="space-y-3">
          {evaluations.map((evaluation) => {
            const isSelected = selectedEvaluation?.id === evaluation.id;
            return (
              <div key={evaluation.id} className="rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setSelectedEvaluation(isSelected ? null : evaluation)}
                  className="w-full text-left p-4 bg-card hover:bg-muted/30 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border capitalize ${getStatusBadge(evaluation.status)}`}>
                        {evaluation.status}
                      </span>
                      <span className="font-semibold text-foreground text-sm">
                        {EVALUATION_TYPE_LABELS[evaluation.type]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      By {evaluation.supervisorName} • {new Date(evaluation.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {evaluation.overallRating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-warning fill-warning" />
                        <span className="font-bold text-base text-foreground">
                          {evaluation.overallRating}
                        </span>
                        <span className="text-xs text-muted-foreground">/5</span>
                      </div>
                    )}
                    {isSelected ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isSelected && (
                  <div className="p-4 bg-muted/20 border-t border-border space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 p-3 rounded-lg border border-border">
                      <div>
                        <span className="text-muted-foreground">Period:</span>
                        <p className="font-semibold text-foreground text-sm mt-0.5">
                          {new Date(evaluation.period.startDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} -{' '}
                          {new Date(evaluation.period.endDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Overall Rating:</span>
                        <p className="font-semibold text-foreground text-sm mt-0.5">
                          {evaluation.overallRating != null ? `${evaluation.overallRating}/5 (${RATING_LABELS[evaluation.overallRating as keyof typeof RATING_LABELS] || 'Good'})` : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category Breakdown</h4>
                      {evaluation.ratings.map((item) => (
                        <div key={item.category} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                          <span className="text-xs font-medium text-foreground">
                            {item.category}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${(item.rating / 5) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-foreground w-6 text-right">
                              {item.rating}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {evaluation.overallComments && (
                      <div>
                        <span className="text-xs font-semibold text-foreground">
                          Supervisor Feedback:
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border">
                          {evaluation.overallComments}
                        </p>
                      </div>
                    )}

                    {evaluation.reviewComments && (
                      <div>
                        <span className="text-xs font-semibold text-foreground">
                          Coordinator Feedback:
                        </span>
                        <p className="mt-1 text-xs text-warning bg-warning/10 p-3 rounded-lg border border-warning/20">
                          {evaluation.reviewComments}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
