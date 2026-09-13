import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  type Auth,
  setPersistence,
  browserLocalPersistence,
  type User,
  onAuthStateChanged,
  connectAuthEmulator,
} from 'firebase/auth';
import {
  getFirestore,
  type Firestore,
  enableIndexedDbPersistence,
  enableNetwork,
  disableNetwork,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import {
  getStorage,
  type FirebaseStorage,
  connectStorageEmulator,
} from 'firebase/storage';
import { getFunctions as getFirebaseFunctions, type Functions, connectFunctionsEmulator } from 'firebase/functions';
import { getMessaging, type Messaging, isSupported } from 'firebase/messaging';
import { initializeAppCheck, type AppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

/**
 * C2 (Spark + Supabase Free) Firebase client.
 *
 * Spark prod surface: Auth, Firestore, Hosting, FCM, App Check.
 * NOT deployed (Blaze-only): Cloud Functions (`functions/` v2) and the
 * Firebase Storage bucket. Trusted logic lives in Supabase Edge Functions;
 * files live in Supabase Storage; metadata stays in Firestore.
 *
 * Storage/Functions SDKs below are emulator/reference-only: they initialize
 * solely when `VITE_USE_FIREBASE_EMULATORS=true` for local reference runs.
 * In prod builds the getters throw a C2 error pointing at the Supabase
 * replacement, so nobody accidentally wires a Blaze-only dependency.
 */

declare global {
  interface Window {
    __USER_ROLE__: string | null;
  }
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let functions: Functions | null = null;
let messaging: Messaging | null = null;
let appCheck: AppCheck | null = null;

export function initializeFirebase(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be initialized in browser environment');
  }

  if (app) {
    return app;
  }

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  // C2: do NOT init Storage/Functions here — Blaze-only, emulator-only (see below).

  configureAuth();
  configureFirestore();
  configureAppCheck();
  configureMessaging();
  configureEmulators();

  return app;
}

function getApp(): FirebaseApp {
  if (!app) throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  return app;
}

function getAuthInstance(): Auth {
  if (!auth) throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  return auth;
}

function getDbInstance(): Firestore {
  if (!db) throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  return db;
}

function getStorageInstance(): FirebaseStorage {
  if (!storage) {
    throw new Error(
      'Firebase Storage is not used (C2 free-only: bucket requires Blaze). ' +
        'Use Supabase Storage buckets (documents/tasks/profiles) via src/features/documents. ' +
        'Storage SDK is emulator/reference-only: set VITE_USE_FIREBASE_EMULATORS=true for local runs.'
    );
  }
  return storage;
}

function getFunctionsInstance(): Functions {
  if (!functions) {
    throw new Error(
      'Cloud Functions are not deployed (C2 free-only: Functions require Blaze). ' +
        'Use Supabase Edge Functions via callEdgeFunction() in src/config/supabase.ts. ' +
        'Functions SDK is emulator/reference-only: set VITE_USE_FIREBASE_EMULATORS=true for local runs.'
    );
  }
  return functions;
}

/** Emulator/reference-only: init Storage SDK for local runs. Never used in prod (C2). */
function ensureStorageForEmulator(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getApp());
  }
  return storage;
}

/** Emulator/reference-only: init Functions SDK for local runs. Never used in prod (C2). */
function ensureFunctionsForEmulator(): Functions {
  if (!functions) {
    functions = getFirebaseFunctions(getApp(), 'asia-southeast1');
  }
  return functions;
}

function configureAuth(): void {
  const authInstance = getAuthInstance();
  setPersistence(authInstance, browserLocalPersistence).catch((error) => {
    console.warn('Failed to set auth persistence:', error);
  });

  onAuthStateChanged(authInstance, (user: User | null) => {
    if (user) {
      user.getIdTokenResult().then((tokenResult) => {
        const role = tokenResult.claims.role as string | undefined;
        if (role) {
          window.__USER_ROLE__ = role;
        }
      });
    } else {
      window.__USER_ROLE__ = null;
    }
  });
}

async function configureFirestore(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_OFFLINE_PERSISTENCE === 'true') {
    try {
      await enableIndexedDbPersistence(getDbInstance());
      console.log('[Firebase] Offline persistence enabled');
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error) {
        const firebaseError = error as { code: string };
        if (firebaseError.code === 'failed-precondition') {
          console.warn('[Firebase] Offline persistence failed: multiple tabs open');
        } else if (firebaseError.code === 'unimplemented') {
          console.warn('[Firebase] Offline persistence not supported in this browser');
        } else {
          console.error('[Firebase] Offline persistence error:', error);
        }
      } else {
        console.error('[Firebase] Offline persistence error:', error);
      }
    }
  }
}

function configureAppCheck(): void {
  const siteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY;
  const enableInDev = import.meta.env.VITE_ENABLE_APP_CHECK_IN_DEV === 'true';
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // reCAPTCHA v3 exchange fails with 400 on localhost unless a debug token
  // and allowed domain are configured. Skip by default in local dev so
  // Auth/Firestore/Edge calls are not throttled by App Check enforcement.
  // Set VITE_ENABLE_APP_CHECK_IN_DEV=true to force-enable when testing App Check.
  if (import.meta.env.DEV && isLocalhost && !enableInDev) {
    console.warn('[Firebase] App Check skipped on localhost (set VITE_ENABLE_APP_CHECK_IN_DEV=true to enable)');
    return;
  }

  if (siteKey && siteKey !== 'your-recaptcha-site-key') {
    try {
      const debugToken = import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN;
      if (debugToken && debugToken !== 'your-debug-token') {
        (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
          debugToken === 'true' ? true : debugToken;
      }
      appCheck = initializeAppCheck(getApp(), {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      console.log('[Firebase] App Check initialized with reCAPTCHA v3');
    } catch (error: unknown) {
      console.error('[Firebase] App Check initialization failed:', error);
    }
  } else {
    console.warn('[Firebase] App Check not configured (missing reCAPTCHA site key)');
  }
}

async function configureMessaging(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_FCM === 'true') {
    const supported = await isSupported();
    if (supported) {
      try {
        messaging = getMessaging(getApp());
        console.log('[Firebase] FCM messaging initialized');
      } catch (error: unknown) {
        console.error('[Firebase] FCM initialization failed:', error);
      }
    } else {
      console.warn('[Firebase] FCM not supported in this environment');
    }
  }
}

function configureEmulators(): void {
  const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

  if (useEmulators && import.meta.env.DEV) {
    console.log('[Firebase] Connecting to emulators...');

    const authHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST;
    const firestoreHost = import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST;
    const storageHost = import.meta.env.VITE_FIREBASE_STORAGE_EMULATOR_HOST;
    const functionsHost = import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST;

    if (authHost) {
      const [host, port] = authHost.split(':');
      connectAuthEmulator(getAuthInstance(), `http://${host}:${port}`);
    }

    if (firestoreHost) {
      const [host, port] = firestoreHost.split(':');
      connectFirestoreEmulator(getDbInstance(), host, parseInt(port, 10));
    }

    if (storageHost) {
      const [host, port] = storageHost.split(':');
      connectStorageEmulator(ensureStorageForEmulator(), host, parseInt(port, 10));
    }

    if (functionsHost) {
      const [host, port] = functionsHost.split(':');
      connectFunctionsEmulator(ensureFunctionsForEmulator(), host, parseInt(port, 10));
    }

    console.log('[Firebase] Emulators connected');
  }
}

export { app, auth, db, storage, functions, messaging, appCheck };

export function getAuthInstancePublic(): Auth {
  return getAuthInstance();
}

export function getFirestoreInstancePublic(): Firestore {
  return getDbInstance();
}

export function getStorageInstancePublic(): FirebaseStorage {
  return getStorageInstance();
}

export function getFunctionsInstancePublic(): Functions {
  return getFunctionsInstance();
}

export function getFunctions(): Functions {
  // C2: route through the guarded instance so prod callers get the
  // Supabase Edge pointer instead of silently initing a Blaze-only SDK.
  getApp();
  return getFunctionsInstance();
}

export function getMessagingInstance(): Messaging | null {
  return messaging;
}

export function getAppCheckInstance(): AppCheck | null {
  return appCheck;
}

export async function enableOfflineSupport(): Promise<void> {
  try {
    await enableIndexedDbPersistence(getDbInstance());
    console.log('[Firebase] Offline support enabled');
  } catch (error: unknown) {
    console.error('[Firebase] Failed to enable offline support:', error);
    throw error;
  }
}

export async function disableOfflineSupport(): Promise<void> {
  try {
    await disableNetwork(getDbInstance());
    console.log('[Firebase] Network disabled (offline mode)');
  } catch (error: unknown) {
    console.error('[Firebase] Failed to disable network:', error);
    throw error;
  }
}

export async function enableOnlineSupport(): Promise<void> {
  try {
    await enableNetwork(getDbInstance());
    console.log('[Firebase] Network enabled (online mode)');
  } catch (error: unknown) {
    console.error('[Firebase] Failed to enable network:', error);
    throw error;
  }
}

export function getCurrentUserRole(): string | null {
  return window.__USER_ROLE__ ?? null;
}

export default getApp;