import { useState, useEffect } from 'react';
import { evaluationService } from '../services/evaluationService';
import { EVALUATION_TYPE_LABELS } from '../types';
import type { Evaluation, EvaluationStatus, EvaluationType } from '../types';
import { EvaluationForm } from './EvaluationForm';

interface EvaluationListProps {
  companyId: string;
  role: 'admin' | 'coordinator' | 'supervisor' | 'trainee';
  userId?: string;
  traineeId?: string;
}

const STATUS_LABELS: Record<EvaluationStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  reviewed: { label: 'Reviewed', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  finalized: { label: 'Finalized', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

export function EvaluationList({ companyId, role, userId, traineeId }: EvaluationListProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<EvaluationType | ''>('');
  const [filterStatus, setFilterStatus] = useState<EvaluationStatus | ''>('');

  useEffect(() => {
    loadEvaluations();
  }, [companyId, userId, traineeId]);

  const loadEvaluations = async () => {
    try {
      setLoading(true);
      let data: Evaluation[] = [];

      if (role === 'trainee' && traineeId) {
        data = await evaluationService.getTraineeEvaluations(traineeId);
      } else if (role === 'supervisor' && userId) {
        data = await evaluationService.getSupervisorEvaluations(userId);
      } else {
        data = await evaluationService.getEvaluations(companyId);
      }

      setEvaluations(data);
    } catch (error) {
      console.error('Failed to load evaluations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = evaluations.filter((e) => {
    if (filterType && e.type !== filterType) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    return true;
  });

  const getRatingBarWidth = (rating: number) => `${(rating / 5) * 100}%`;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {role === 'trainee' ? 'My Evaluations' : 'Evaluations'}
          </h2>
          <div className="flex flex-wrap gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as EvaluationType | '')}
              aria-label="Filter by evaluation type"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Types</option>
              {Object.entries(EVALUATION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as EvaluationStatus | '')}
              aria-label="Filter by status"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="reviewed">Reviewed</option>
              <option value="finalized">Finalized</option>
            </select>
            {role === 'supervisor' && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                New Evaluation
              </button>
            )}
          </div>
        </div>

        {showForm && traineeId && (
          <EvaluationForm
            traineeId={traineeId}
            traineeName="Trainee"
            companyId={companyId}
            onSuccess={() => {
              setShowForm(false);
              loadEvaluations();
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No evaluations found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((evaluation) => {
              const statusInfo = STATUS_LABELS[evaluation.status];
              return (
                <div
                  key={evaluation.id}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {evaluation.traineeName}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {EVALUATION_TYPE_LABELS[evaluation.type]} • by {evaluation.supervisorName}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {evaluation.overallRating && (
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: getRatingBarWidth(evaluation.overallRating) }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {evaluation.overallRating}
                          </span>
                        </div>
                      )}
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(evaluation.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {evaluation.overallComments && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {evaluation.overallComments}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
