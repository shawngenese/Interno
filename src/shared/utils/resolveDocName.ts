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
    const snap = await getDoc(doc(getFirestoreInstancePublic(), collection, id));
    if (snap.exists()) {
      const val = (snap.data() as Record<string, unknown>)[nameField];
      if (typeof val === 'string' && val) {
        cache.set(key, { value: val, expiresAt: Date.now() + CACHE_TTL_MS });
        return val;
      }
    }
  } catch { /* ignore */ }
  return '';
}
