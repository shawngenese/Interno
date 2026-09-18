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
  draft: { label: 'Draft', color: 'bg-[#EFEFEF] text-[#3A3A3A] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]' },
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
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-[#121212] dark:text-white">
            {role === 'trainee' ? 'My Evaluations' : 'Evaluations'}
          </h2>
          <div className="flex flex-wrap gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as EvaluationType | '')}
              aria-label="Filter by evaluation type"
              className="px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
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
              className="px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
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
              <div key={i} className="h-20 bg-[#EFEFEF] dark:bg-[#3A3A3A] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#757575] dark:text-[#9E9E9E]">No evaluations found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((evaluation) => {
              const statusInfo = STATUS_LABELS[evaluation.status];
              return (
                <div
                  key={evaluation.id}
                  className="p-4 bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 rounded-lg hover:bg-[#EFEFEF] dark:hover:bg-[#3A3A3A] transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-[#121212] dark:text-white">
                          {evaluation.traineeName}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-[#555555] dark:text-[#9E9E9E]">
                        {EVALUATION_TYPE_LABELS[evaluation.type]} • by {evaluation.supervisorName}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {evaluation.overallRating && (
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-[#D5D5D5] dark:bg-[#555555] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: getRatingBarWidth(evaluation.overallRating) }}
                            />
                          </div>
                          <span className="text-sm font-medium text-[#121212] dark:text-white">
                            {evaluation.overallRating}
                          </span>
                        </div>
                      )}
                      <span className="text-sm text-[#757575] dark:text-[#9E9E9E]">
                        {new Date(evaluation.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {evaluation.overallComments && (
                    <p className="mt-2 text-sm text-[#555555] dark:text-[#9E9E9E] line-clamp-2">
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
