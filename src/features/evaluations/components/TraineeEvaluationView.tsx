import { useState, useEffect } from 'react';
import { evaluationService } from '../services/evaluationService';
import { EVALUATION_TYPE_LABELS, RATING_LABELS } from '../types';
import type { Evaluation } from '../types';

interface TraineeEvaluationViewProps {
  traineeId: string;
}

export function TraineeEvaluationView({ traineeId }: TraineeEvaluationViewProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);

  useEffect(() => {
    loadEvaluations();
  }, [traineeId]);

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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      draft: 'bg-[#EFEFEF] text-[#3A3A3A] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]',
      submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      reviewed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      finalized: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    };
    return badges[status] || 'bg-[#EFEFEF] text-[#3A3A3A]';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-[#EFEFEF] dark:bg-[#3A3A3A] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (evaluations.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <div className="text-center py-12">
          <p className="text-[#757575] dark:text-[#9E9E9E]">No evaluations yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <h2 className="text-lg font-semibold text-[#121212] dark:text-white mb-4">
          My Evaluations
        </h2>

        <div className="space-y-3">
          {evaluations.map((evaluation) => {
            const isSelected = selectedEvaluation?.id === evaluation.id;
            return (
              <div key={evaluation.id}>
                <button
                  onClick={() => setSelectedEvaluation(isSelected ? null : evaluation)}
                  className="w-full text-left p-4 bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 rounded-lg hover:bg-[#EFEFEF] dark:hover:bg-[#3A3A3A] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(evaluation.status)}`}>
                          {evaluation.status.charAt(0).toUpperCase() + evaluation.status.slice(1)}
                        </span>
                        <span className="font-medium text-[#121212] dark:text-white">
                          {EVALUATION_TYPE_LABELS[evaluation.type]}
                        </span>
                      </div>
                      <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">
                        By {evaluation.supervisorName} • {new Date(evaluation.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {evaluation.overallRating && (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg text-[#121212] dark:text-white">
                          {evaluation.overallRating}
                        </span>
                        <span className="text-sm text-[#757575] dark:text-[#9E9E9E]">/5</span>
                      </div>
                    )}
                  </div>
                </button>

                {isSelected && (
                  <div className="mt-2 p-4 bg-white dark:bg-[#1E1E1E] border border-[#D5D5D5] dark:border-[#3A3A3A] rounded-lg">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-[#757575] dark:text-[#9E9E9E]">Period:</span>
                          <p className="font-medium text-[#121212] dark:text-white">
                            {new Date(evaluation.period.startDate).toLocaleDateString()} -{' '}
                            {new Date(evaluation.period.endDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-[#757575] dark:text-[#9E9E9E]">Overall Rating:</span>
                          <p className="font-medium text-[#121212] dark:text-white">
                            {evaluation.overallRating != null ? `${evaluation.overallRating}/5 (${RATING_LABELS[evaluation.overallRating as keyof typeof RATING_LABELS]})` : 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {evaluation.ratings.map((item) => (
                          <div key={item.category} className="flex items-center justify-between py-1">
                            <span className="text-sm text-[#3A3A3A] dark:text-[#BDBDBD]">
                              {item.category}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-[#D5D5D5] dark:bg-[#555555] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 rounded-full"
                                  style={{ width: `${(item.rating / 5) * 100}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium text-[#121212] dark:text-white w-8 text-right">
                                {item.rating}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {evaluation.overallComments && (
                        <div>
                          <span className="text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD]">
                            Supervisor Comments:
                          </span>
                          <p className="mt-1 text-sm text-[#555555] dark:text-[#9E9E9E] bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 p-3 rounded-lg">
                            {evaluation.overallComments}
                          </p>
                        </div>
                      )}

                      {evaluation.reviewComments && (
                        <div>
                          <span className="text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD]">
                            Coordinator Feedback:
                          </span>
                          <p className="mt-1 text-sm text-[#555555] dark:text-[#9E9E9E] bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                            {evaluation.reviewComments}
                          </p>
                        </div>
                      )}
                    </div>
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
