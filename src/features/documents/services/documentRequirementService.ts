import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirestoreInstancePublic } from '@/config/firebase';
import type { DocumentRequirement, DocumentRequirementFormData, DocumentType, PlacementType } from '../types';

const COLLECTION = 'document_requirements';

export const documentRequirementService = {
  async getRequirements(companyId: string, requiredFor?: PlacementType | 'all'): Promise<DocumentRequirement[]> {
    const db = getFirestoreInstancePublic();
    let q = query(
      collection(db, COLLECTION),
      where('companyId', '==', companyId),
      orderBy('order', 'asc')
    );

    if (requiredFor) {
      q = query(
        collection(db, COLLECTION),
        where('companyId', '==', companyId),
        where('requiredFor', 'in', [requiredFor, 'all']),
        orderBy('order', 'asc')
      );
    }

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentRequirement));
  },

  async createRequirement(data: DocumentRequirementFormData): Promise<DocumentRequirement> {
    const db = getFirestoreInstancePublic();
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id, ...data } as DocumentRequirement;
  },

  async updateRequirement(id: string, data: Partial<DocumentRequirementFormData>): Promise<void> {
    const db = getFirestoreInstancePublic();
    await updateDoc(doc(db, COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteRequirement(id: string): Promise<void> {
    const db = getFirestoreInstancePublic();
    await deleteDoc(doc(db, COLLECTION, id));
  },

  async getRequirementProgress(
    companyId: string,
    traineeId: string,
    placementType: PlacementType
  ): Promise<{ total: number; completed: number; required: number; documents: { type: DocumentType; required: boolean; uploaded: boolean; approved: boolean }[] }> {
    const db = getFirestoreInstancePublic();
    
    // Get requirements for this company and placement type
    const reqQuery = query(
      collection(db, COLLECTION),
      where('companyId', '==', companyId),
      where('requiredFor', 'in', [placementType, 'all']),
      orderBy('order', 'asc')
    );
    const reqSnap = await getDocs(reqQuery);
    const requirements = reqSnap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentRequirement));

    // Get trainee's uploaded documents
    const docQuery = query(
      collection(db, 'documents'),
      where('traineeId', '==', traineeId)
    );
    const docSnap = await getDocs(docQuery);
    const uploadedTypes = new Set(docSnap.docs.map(d => d.data().type as string));
    const approvedTypes = new Set(
      docSnap.docs
        .filter(d => d.data().status === 'approved')
        .map(d => d.data().type as string)
    );

    const documents = requirements.map(req => ({
      type: req.documentType,
      required: req.required,
      uploaded: uploadedTypes.has(req.documentType),
      approved: approvedTypes.has(req.documentType),
    }));

    const total = requirements.length;
    const completed = documents.filter(d => d.approved).length;
    const required = requirements.filter(d => d.required).length;

    return { total, completed, required, documents };
  },
};
