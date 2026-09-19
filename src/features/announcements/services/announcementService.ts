import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirestoreInstancePublic } from '@/config/firebase';
import type { Announcement, AnnouncementFormData, AnnouncementStatus } from '../types';

const COLLECTION = 'announcements';

export const announcementService = {
  async getAnnouncements(
    companyId: string | undefined,
    params: {
      status?: AnnouncementStatus;
      targetRole?: string;
      departmentId?: string;
    } = {}
  ): Promise<Announcement[]> {
    const db = getFirestoreInstancePublic();
    let q;
    if (companyId) {
      q = query(
        collection(db, COLLECTION),
        where('companyId', '==', companyId),
        orderBy('createdAt', 'desc')
      );
    } else {
      // Admin: no companyId filter, get all
      q = query(
        collection(db, COLLECTION),
        orderBy('createdAt', 'desc')
      );
    }

    if (params.status) {
      q = query(q, where('status', '==', params.status));
    }

    const snap = await getDocs(q);
    let announcements = snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));

    if (params.targetRole) {
      announcements = announcements.filter(a =>
        a.targetRoles.includes(params.targetRole as 'admin' | 'coordinator' | 'supervisor' | 'trainee')
      );
    }

    if (params.departmentId) {
      announcements = announcements.filter(a =>
        !a.departmentId || a.departmentId === params.departmentId
      );
    }

    return announcements;
  },

  async getAnnouncement(id: string): Promise<Announcement> {
    const db = getFirestoreInstancePublic();
    const docSnap = await getDoc(doc(db, COLLECTION, id));
    if (!docSnap.exists()) {
      throw new Error('Announcement not found');
    }
    return { id: docSnap.id, ...docSnap.data() } as Announcement;
  },

  async createAnnouncement(data: AnnouncementFormData): Promise<Announcement> {
    const db = getFirestoreInstancePublic();
    // Filter out undefined values (Firestore doesn't accept undefined)
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    );
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...cleanData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id, ...data } as Announcement;
  },

  async updateAnnouncement(id: string, data: Partial<AnnouncementFormData>): Promise<void> {
    const db = getFirestoreInstancePublic();
    await updateDoc(doc(db, COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async publishAnnouncement(id: string): Promise<void> {
    const db = getFirestoreInstancePublic();
    await updateDoc(doc(db, COLLECTION, id), {
      status: 'published',
      updatedAt: serverTimestamp(),
    });
  },

  async archiveAnnouncement(id: string): Promise<void> {
    const db = getFirestoreInstancePublic();
    await updateDoc(doc(db, COLLECTION, id), {
      status: 'archived',
      updatedAt: serverTimestamp(),
    });
  },

  async deleteAnnouncement(id: string): Promise<void> {
    const db = getFirestoreInstancePublic();
    await deleteDoc(doc(db, COLLECTION, id));
  },

  async togglePin(id: string, pinned: boolean): Promise<void> {
    const db = getFirestoreInstancePublic();
    await updateDoc(doc(db, COLLECTION, id), {
      pinned: !pinned,
      updatedAt: serverTimestamp(),
    });
  },

  async getActiveAnnouncements(companyId: string, userRole: string): Promise<Announcement[]> {
    const db = getFirestoreInstancePublic();
    const q = query(
      collection(db, COLLECTION),
      where('companyId', '==', companyId),
      where('status', '==', 'published'),
      orderBy('pinned', 'desc'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const announcements = snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));

    return announcements.filter(a => {
      if (a.targetRoles.length === 0) return true;
      return a.targetRoles.includes(userRole as 'admin' | 'coordinator' | 'supervisor' | 'trainee');
    });
  },

  async getPublishedCount(companyId: string): Promise<number> {
    const db = getFirestoreInstancePublic();
    const q = query(
      collection(db, COLLECTION),
      where('companyId', '==', companyId),
      where('status', '==', 'published')
    );
    const snap = await getDocs(q);
    return snap.size;
  },
};
