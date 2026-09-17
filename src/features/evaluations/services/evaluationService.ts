import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirestoreInstancePublic } from '@/config/firebase';
import type { Evaluation, EvaluationFormData, EvaluationStatus } from '../types';

const COLLECTION = 'evaluations';

export const evaluationService = {
  async getEvaluations(
    companyId: string,
    params: {
      traineeId?: string;
      supervisorId?: string;
      status?: EvaluationStatus;
      type?: string;
    } = {}
  ): Promise<Evaluation[]> {
    const db = getFirestoreInstancePublic();
    let q = query(
      collection(db, COLLECTION),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );

    if (params.traineeId) {
      q = query(q, where('traineeId', '==', params.traineeId));
    }
    if (params.supervisorId) {
      q = query(q, where('supervisorId', '==', params.supervisorId));
    }
    if (params.status) {
      q = query(q, where('status', '==', params.status));
    }

    const snap = await getDocs(q);
    let evaluations = snap.docs.map(d => ({ id: d.id, ...d.data() } as Evaluation));

    if (params.type) {
      evaluations = evaluations.filter(e => e.type === params.type);
    }

    return evaluations;
  },

  async getEvaluation(id: string): Promise<Evaluation> {
    const db = getFirestoreInstancePublic();
    const docSnap = await getDoc(doc(db, COLLECTION, id));
    if (!docSnap.exists()) {
      throw new Error('Evaluation not found');
    }
    return { id: docSnap.id, ...docSnap.data() } as Evaluation;
  },

  async createEvaluation(data: EvaluationFormData): Promise<Evaluation> {
    const db = getFirestoreInstancePublic();
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id, ...data } as Evaluation;
  },

  async updateEvaluation(id: string, data: Partial<EvaluationFormData>): Promise<void> {
    const db = getFirestoreInstancePublic();
    await updateDoc(doc(db, COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async submitEvaluation(id: string): Promise<void> {
    const db = getFirestoreInstancePublic();
    await updateDoc(doc(db, COLLECTION, id), {
      status: 'submitted',
      updatedAt: serverTimestamp(),
    });
  },

  async reviewEvaluation(
    id: string,
    reviewerId: string,
    reviewComments?: string
  ): Promise<void> {
    const db = getFirestoreInstancePublic();
    await updateDoc(doc(db, COLLECTION, id), {
      status: 'reviewed',
      reviewedBy: reviewerId,
      reviewedAt: serverTimestamp(),
      reviewComments: reviewComments || null,
      updatedAt: serverTimestamp(),
    });
  },

  async finalizeEvaluation(
    id: string,
    finalizerId: string
  ): Promise<void> {
    const db = getFirestoreInstancePublic();
    await updateDoc(doc(db, COLLECTION, id), {
      status: 'finalized',
      finalizedBy: finalizerId,
      finalizedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async deleteEvaluation(id: string): Promise<void> {
    const db = getFirestoreInstancePublic();
    await updateDoc(doc(db, COLLECTION, id), {
      status: 'draft',
      updatedAt: serverTimestamp(),
    });
  },

  async getTraineeEvaluations(traineeId: string): Promise<Evaluation[]> {
    const db = getFirestoreInstancePublic();
    const q = query(
      collection(db, COLLECTION),
      where('traineeId', '==', traineeId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Evaluation));
  },

  async getSupervisorEvaluations(supervisorId: string): Promise<Evaluation[]> {
    const db = getFirestoreInstancePublic();
    const q = query(
      collection(db, COLLECTION),
      where('supervisorId', '==', supervisorId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Evaluation));
  },

  async getPendingReviewsCount(companyId: string): Promise<number> {
    const db = getFirestoreInstancePublic();
    const q = query(
      collection(db, COLLECTION),
      where('companyId', '==', companyId),
      where('status', '==', 'submitted')
    );
    const snap = await getDocs(q);
    return snap.size;
  },
};
