import { useState, useEffect, useCallback, useRef } from 'react';
import { evaluationService } from '../services/evaluationService';
import { EVALUATION_TYPE_LABELS } from '../types';
import type { Evaluation, EvaluationStatus, EvaluationType } from '../types';
import { EvaluationForm } from './EvaluationForm';
import { EvaluationReview } from './EvaluationReview';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const FIRESTORE_IN_LIMIT = 30;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface EvaluationListProps {
  companyId?: string;
  role?: 'admin' | 'coordinator' | 'supervisor' | 'trainee';
  userId?: string;
  traineeId?: string;
}

const STATUS_LABELS: Record<EvaluationStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-[#EFEFEF] text-[#3A3A3A] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  reviewed: { label: 'Reviewed', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  finalized: { label: 'Finalized', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

export function EvaluationList({ companyId: companyIdProp, role, userId: userIdProp, traineeId: traineeIdProp }: EvaluationListProps) {
  const { user, companyId: userCompanyId } = useAuth();
  const companyId = companyIdProp || userCompanyId || '';
  const userId = userIdProp || user?.uid || '';
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>(traineeIdProp || '');
  const [selectedTraineeName, setSelectedTraineeName] = useState<string>('');
  const [filterType, setFilterType] = useState<EvaluationType | ''>('');
  const [filterStatus, setFilterStatus] = useState<EvaluationStatus | ''>('');
  const [trainees, setTrainees] = useState<{ id: string; name: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const loadEvaluations = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      let data: Evaluation[] = [];

      if (role === 'trainee' && traineeIdProp) {
        data = await evaluationService.getTraineeEvaluations(traineeIdProp);
      } else if (role === 'supervisor' && userId) {
        data = await evaluationService.getSupervisorEvaluations(userId);
      } else {
        data = await evaluationService.getEvaluations(companyId);
      }

      if (!signal?.aborted) setEvaluations(data);
    } catch (error) {
      if (!signal?.aborted) console.error('Failed to load evaluations:', error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [companyId, role, userId, traineeIdProp]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    loadEvaluations(controller.signal);
    return () => controller.abort();
  }, [loadEvaluations]);

  useEffect(() => {
    let isMounted = true;
    async function loadTrainees() {
      if (!user?.uid || role !== 'supervisor') return;
      try {
        const db = getFirestoreInstancePublic();
        const userSnap = await getDocs(
          query(collection(db, 'users'), where('__name__', '==', user.uid))
        );
        if (!isMounted || userSnap.empty) return;
        const resolvedCompanyId = userSnap.docs[0].data().companyId || '';
        if (!resolvedCompanyId) return;

        const traineeSnap = await getDocs(
          query(collection(db, 'trainees'), where('status', '==', 'active'), where('companyId', '==', resolvedCompanyId), where('supervisorId', '==', user.uid))
        );
        if (!isMounted) return;

        const traineeData = traineeSnap.docs.map((d) => ({ id: d.id, userId: d.data().userId }));
        const uids = [...new Set(traineeData.map((t) => t.userId).filter(Boolean))];
        const userMap = new Map<string, string>();

        const chunks = chunkArray(uids, FIRESTORE_IN_LIMIT);
        for (const chunk of chunks) {
          const usersSnap = await getDocs(
            query(collection(db, 'users'), where('__name__', 'in', chunk))
          );
          usersSnap.docs.forEach((doc) => {
            userMap.set(doc.id, doc.data().displayName || doc.id);
          });
        }
        if (!isMounted) return;

        setTrainees(traineeData.map((t) => ({
          id: t.id,
          name: userMap.get(t.userId) || t.id,
        })));
      } catch (err) {
        if (isMounted) console.error('Failed to load trainees:', err);
      }
    }
    loadTrainees();
    return () => { isMounted = false; };
  }, [user?.uid, role]);

  const filtered = evaluations.filter((e) => {
    if (filterType && e.type !== filterType) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    return true;
  });

  const getRatingBarWidth = (rating: number) => `${(rating / 5) * 100}%`;

  if (selectedEvaluation) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setSelectedEvaluation(null); loadEvaluations(); }}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
        >
          ← Back to evaluations
        </button>
        <EvaluationReview evaluationId={selectedEvaluation.id} onClose={() => { setSelectedEvaluation(null); loadEvaluations(); }} />
      </div>
    );
  }

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
              className="px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="reviewed">Reviewed</option>
              <option value="finalized">Finalized</option>
            </select>
            {role === 'supervisor' && (
              <button
                onClick={() => { setShowForm(!showForm); setSelectedTraineeId(''); setSelectedTraineeName(''); }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {showForm ? 'Cancel' : 'New Evaluation'}
              </button>
            )}
          </div>
        </div>

        {showForm && role === 'supervisor' && (
          <div className="mb-6 p-4 bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 rounded-lg">
            <label htmlFor="select-trainee" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-2">
              Select Trainee
            </label>
            <select
              id="select-trainee"
              value={selectedTraineeId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedTraineeId(id);
                const found = trainees.find((t) => t.id === id);
                setSelectedTraineeName(found?.name || '');
              }}
              aria-label="Select trainee to evaluate"
              className="w-full px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Choose a trainee --</option>
              {trainees.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {showForm && selectedTraineeId && selectedTraineeName && (
          <EvaluationForm
            traineeId={selectedTraineeId}
            traineeName={selectedTraineeName}
            companyId={companyId}
            onSuccess={() => {
              setShowForm(false);
              setSelectedTraineeId('');
              setSelectedTraineeName('');
              loadEvaluations();
            }}
            onCancel={() => { setShowForm(false); setSelectedTraineeId(''); setSelectedTraineeName(''); }}
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
                <button
                  key={evaluation.id}
                  onClick={() => setSelectedEvaluation(evaluation)}
                  className="w-full text-left p-4 bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 rounded-lg hover:bg-[#EFEFEF] dark:hover:bg-[#3A3A3A] transition-colors"
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
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
