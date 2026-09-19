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
import type { PlacementRequest, PlacementStatus } from '@/features/admin/types';

export const placementService = {
  async requestExternalPlacement(
    traineeId: string,
    traineeName: string,
    traineeEmail: string,
    externalCompanyId: string,
    externalCompanyName: string,
    requestNotes?: string,
  ): Promise<PlacementRequest> {
    const db = getFirestoreInstancePublic();
    const ref = await addDoc(collection(db, 'placement_requests'), {
      traineeId,
      traineeName,
      traineeEmail,
      externalCompanyId,
      externalCompanyName,
      requestNotes: requestNotes || null,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return this.getPlacementRequest(ref.id);
  },

  async getPlacementRequest(id: string): Promise<PlacementRequest> {
    const db = getFirestoreInstancePublic();
    const snap = await getDoc(doc(db, 'placement_requests', id));
    if (!snap.exists()) {
      throw new Error('Placement request not found');
    }
    return { id: snap.id, ...snap.data() } as PlacementRequest;
  },

  async getPlacementRequests(
    companyId?: string,
    status?: PlacementStatus,
  ): Promise<PlacementRequest[]> {
    const db = getFirestoreInstancePublic();
    let q = query(collection(db, 'placement_requests'), orderBy('createdAt', 'desc'));
    
    if (companyId) {
      // Coordinator scoping: get trainee IDs in this company, then filter requests
      const traineeSnap = await getDocs(
        query(collection(db, 'trainees'), where('companyId', '==', companyId)),
      );
      const traineeIds = traineeSnap.docs.map((d) => d.id);
      if (traineeIds.length === 0) return [];

      // Firestore `in` query supports max 30 items per batch
      const results: PlacementRequest[] = [];
      for (let i = 0; i < traineeIds.length; i += 30) {
        const batch = traineeIds.slice(i, i + 30);
        let batchQ = query(
          collection(db, 'placement_requests'),
          where('traineeId', 'in', batch),
          orderBy('createdAt', 'desc'),
        );
        if (status) {
          batchQ = query(batchQ, where('status', '==', status));
        }
        const snap = await getDocs(batchQ);
        results.push(...snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PlacementRequest)));
      }
      // Sort combined results by createdAt desc
      results.sort((a, b) => {
        const aTime = a.createdAt?.seconds ?? 0;
        const bTime = b.createdAt?.seconds ?? 0;
        return bTime - aTime;
      });
      return results;
    }
    
    if (status) {
      q = query(q, where('status', '==', status));
    }
    
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PlacementRequest));
  },

  async approvePlacementRequest(
    requestId: string,
    reviewerId: string,
    reviewerNotes?: string,
  ): Promise<PlacementRequest> {
    const db = getFirestoreInstancePublic();
    await updateDoc(doc(db, 'placement_requests', requestId), {
      status: 'approved',
      reviewedBy: reviewerId,
      reviewerNotes: reviewerNotes || null,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return this.getPlacementRequest(requestId);
  },

  async rejectPlacementRequest(
    requestId: string,
    reviewerId: string,
    reviewerNotes?: string,
  ): Promise<PlacementRequest> {
    const db = getFirestoreInstancePublic();
    await updateDoc(doc(db, 'placement_requests', requestId), {
      status: 'rejected',
      reviewedBy: reviewerId,
      reviewerNotes: reviewerNotes || null,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return this.getPlacementRequest(requestId);
  },

  async getPendingPlacementRequestsCount(): Promise<number> {
    const db = getFirestoreInstancePublic();
    const q = query(
      collection(db, 'placement_requests'),
      where('status', '==', 'pending'),
    );
    const snap = await getDocs(q);
    return snap.size;
  },

  async getTraineePlacementRequests(traineeId: string): Promise<PlacementRequest[]> {
    const db = getFirestoreInstancePublic();
    const q = query(
      collection(db, 'placement_requests'),
      where('traineeId', '==', traineeId),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PlacementRequest));
  },
};
