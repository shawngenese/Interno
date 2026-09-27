import { doc, getDoc } from 'firebase/firestore';
import { getFirestoreInstancePublic } from '@/config/firebase';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { value: string; expiresAt: number }>();

export async function resolveDocName(
  collection: string,
  id: string,
  nameField = 'name',
): Promise<string> {
  if (!id) return '-';
  const key = `${collection}/${id}/${nameField}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) cache.delete(key);
  try {
    const db = getFirestoreInstancePublic();
    const snap = await getDoc(doc(db, collection, id));
    if (snap.exists()) {
      const data = snap.data() as Record<string, unknown>;
      let val = data[nameField];

      // Smart fallbacks if the requested field is not present
      if (!val || typeof val !== 'string') {
        if (collection === 'users') {
          val = data.displayName || data.name || data.email;
        } else if (collection === 'trainees' || collection === 'supervisors' || collection === 'coordinators') {
          val = data.name || data.displayName;
          if (!val && data.userId && typeof data.userId === 'string') {
            const userSnap = await getDoc(doc(db, 'users', data.userId));
            if (userSnap.exists()) {
              const uData = userSnap.data() as Record<string, unknown>;
              val = uData.displayName || uData.name || uData.email;
            }
          }
        } else if (collection === 'companies' || collection === 'departments' || collection === 'work_schedules' || collection === 'ojt_schedules') {
          val = data.name || data.title;
        }
      }

      if (typeof val === 'string' && val) {
        cache.set(key, { value: val, expiresAt: Date.now() + CACHE_TTL_MS });
        return val;
      }
    }
  } catch { /* ignore */ }
  return '';
}
