import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'interno-test';

let adminApp;
if (getApps().length === 0) {
  adminApp = initializeApp({ projectId: PROJECT_ID });
} else {
  adminApp = getApps()[0];
}

export const adminDb = getFirestore(adminApp);