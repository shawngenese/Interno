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
    const announcements: Announcement[] = [];

    if (companyId) {
      // Fetch company-specific announcements
      const companyQ = query(
        collection(db, COLLECTION),
        where('companyId', '==', companyId),
        orderBy('createdAt', 'desc')
      );
      const companySnap = await getDocs(companyQ);
      announcements.push(...companySnap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));

      // Also fetch system-wide announcements (no companyId)
      try {
        const systemQ = query(
          collection(db, COLLECTION),
          where('status', '!=', 'archived'),
          orderBy('createdAt', 'desc')
        );
        const systemSnap = await getDocs(systemQ);
        for (const d of systemSnap.docs) {
          const data = d.data() as Announcement;
          if (!data.companyId && !announcements.some(a => a.id === d.id)) {
            announcements.push({ ...data, id: d.id } as Announcement);
          }
        }
      } catch {
        // System-wide query may fail if rules don't allow it yet; skip silently
      }
      // Re-sort by createdAt desc
      announcements.sort((a, b) => {
        const aTime = (a as unknown as Record<string, unknown>).createdAt as { toMillis?: () => number } | undefined;
        const bTime = (b as unknown as Record<string, unknown>).createdAt as { toMillis?: () => number } | undefined;
        return (bTime?.toMillis?.() ?? 0) - (aTime?.toMillis?.() ?? 0);
      });
    } else {
      // Admin or trainee without companyId: get all published + system-wide
      const q = query(
        collection(db, COLLECTION),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      announcements.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
    }

    if (params.status) {
      for (let i = announcements.length - 1; i >= 0; i--) {
        if (announcements[i].status !== params.status) {
          announcements.splice(i, 1);
        }
      }
    }

    if (params.targetRole) {
      for (let i = announcements.length - 1; i >= 0; i--) {
        if (!announcements[i].targetRoles.includes(params.targetRole as 'admin' | 'coordinator' | 'supervisor' | 'trainee')) {
          announcements.splice(i, 1);
        }
      }
    }

    if (params.departmentId) {
      for (let i = announcements.length - 1; i >= 0; i--) {
        if (announcements[i].departmentId && announcements[i].departmentId !== params.departmentId) {
          announcements.splice(i, 1);
        }
      }
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
    const all: Announcement[] = [];

    // Company-specific published announcements
    const companyQ = query(
      collection(db, COLLECTION),
      where('companyId', '==', companyId),
      where('status', '==', 'published'),
      orderBy('pinned', 'desc'),
      orderBy('createdAt', 'desc')
    );
    const companySnap = await getDocs(companyQ);
    all.push(...companySnap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));

    // System-wide published announcements (no companyId)
    try {
      const systemQ = query(
        collection(db, COLLECTION),
        where('status', '==', 'published'),
        orderBy('pinned', 'desc'),
        orderBy('createdAt', 'desc')
      );
      const systemSnap = await getDocs(systemQ);
      for (const d of systemSnap.docs) {
        const data = d.data() as Announcement;
        if (!data.companyId && !all.some(a => a.id === d.id)) {
          all.push({ ...data, id: d.id } as Announcement);
        }
      }
    } catch {
      // System-wide query may fail if rules don't allow it yet; skip silently
    }

    return all.filter(a => {
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
