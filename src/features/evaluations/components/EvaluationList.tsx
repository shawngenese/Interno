import { useState, useEffect, useCallback, useRef } from 'react';
import { evaluationService } from '../services/evaluationService';
import { EVALUATION_TYPE_LABELS } from '../types';
import type { Evaluation, EvaluationStatus, EvaluationType } from '../types';
import { EvaluationForm } from './EvaluationForm';
import { EvaluationReview } from './EvaluationReview';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { ArrowLeft, Plus, Star } from 'lucide-react';

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
  viewerRole?: 'admin' | 'coordinator' | 'supervisor' | 'trainee';
  userId?: string;
  traineeId?: string;
}

const STATUS_LABELS: Record<EvaluationStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground border-border' },
  submitted: { label: 'Submitted', color: 'bg-primary/10 text-primary border-primary/20' },
  reviewed: { label: 'Reviewed', color: 'bg-warning/10 text-warning border-warning/20' },
  finalized: { label: 'Finalized', color: 'bg-success/10 text-success border-success/20' },
};

export function EvaluationList({ companyId: companyIdProp, viewerRole, userId: userIdProp, traineeId: traineeIdProp }: EvaluationListProps) {
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

      if (viewerRole === 'trainee' && traineeIdProp) {
        data = await evaluationService.getTraineeEvaluations(traineeIdProp);
      } else if (viewerRole === 'supervisor' && userId) {
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
  }, [companyId, viewerRole, userId, traineeIdProp]);

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
      if (!user?.uid || viewerRole !== 'supervisor') return;
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
  }, [user?.uid, viewerRole]);

  const filtered = evaluations.filter((e) => {
    if (filterType && e.type !== filterType) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    return true;
  });

  const getRatingBarWidth = (rating: number) => `${(rating / 5) * 100}%`;

  if (selectedEvaluation) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setSelectedEvaluation(null); loadEvaluations(); }}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to evaluations
        </Button>
        <EvaluationReview evaluationId={selectedEvaluation.id} onClose={() => { setSelectedEvaluation(null); loadEvaluations(); }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {viewerRole === 'trainee' ? 'My Evaluations' : 'Evaluations'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Performance reviews, monthly assessments, and final evaluations</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as EvaluationType | '')}
              aria-label="Filter by evaluation type"
              className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
              className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="reviewed">Reviewed</option>
              <option value="finalized">Finalized</option>
            </select>
            {viewerRole === 'supervisor' && (
              <Button
                onClick={() => { setShowForm(!showForm); setSelectedTraineeId(''); setSelectedTraineeName(''); }}
                variant={showForm ? 'secondary' : 'primary'}
                size="md"
              >
                {showForm ? 'Cancel' : (
                  <>
                    <Plus className="w-4 h-4 mr-1.5" />
                    New Evaluation
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {showForm && viewerRole === 'supervisor' && (
          <div className="mb-6 p-4 bg-muted/40 rounded-xl border border-border">
            <label htmlFor="select-trainee" className="block text-xs font-semibold text-foreground mb-1.5">
              Select Trainee to Evaluate
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
              className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">-- Choose a trainee --</option>
              {trainees.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {showForm && selectedTraineeId && selectedTraineeName && (
          <div className="mb-6">
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
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={80} className="rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No evaluations found"
            description="There are no evaluation records matching your selected filter criteria."
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((evaluation) => {
              const statusInfo = STATUS_LABELS[evaluation.status];
              return (
                <button
                  key={evaluation.id}
                  onClick={() => setSelectedEvaluation(evaluation)}
                  className="w-full text-left p-4 bg-card border border-border rounded-xl hover:border-primary/60 hover:bg-muted/30 transition-all cursor-pointer space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground text-sm">
                          {evaluation.traineeName}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border capitalize ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {EVALUATION_TYPE_LABELS[evaluation.type]} • by {evaluation.supervisorName}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {evaluation.overallRating && (
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: getRatingBarWidth(evaluation.overallRating) }}
                            />
                          </div>
                          <span className="text-sm font-bold text-foreground flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                            {evaluation.overallRating}
                          </span>
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(evaluation.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  {evaluation.overallComments && (
                    <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/40 p-2.5 rounded-lg border border-border">
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
