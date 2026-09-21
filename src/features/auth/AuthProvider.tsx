import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  getAuth,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { initializeFirebase, getFirestoreInstancePublic } from '@/config/firebase';

export type UserRole = 'admin' | 'supervisor' | 'coordinator' | 'trainee' | null;

const VALID_ROLES: UserRole[] = ['admin', 'supervisor', 'coordinator', 'trainee'];

function isValidRole(value: unknown): value is Exclude<UserRole, null> {
  return (
    typeof value === 'string' &&
    (VALID_ROLES as (string | null)[]).includes(value)
  );
}

interface AuthContextType {
  user: User | null;
  role: UserRole;
  companyId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Spark-safe: no Cloud Functions callable (Functions require Blaze and are
  // not deployed, so the old httpsCallable('getCurrentUserRole') 404'd as HTML
  // and failed CORS). Read role from ID-token custom claims first, fall back
  // to Firestore users/{uid}.role (owner-readable per firestore.rules).
  const refreshUserRole = async (targetUser?: User | null) => {
    try {
      const app = initializeFirebase();
      const auth = getAuth(app);
      const currentUser = targetUser ?? auth.currentUser;
      if (!currentUser) {
        setRole(null);
        return;
      }
      // Force ID token refresh so newly-assigned custom claims (e.g. first
      // admin via assign-admin.cjs) are visible without manual sign-out/in.
      // getIdTokenResult(true) forces a server refresh AND returns the fresh
      // result in one call — using getIdToken(true) + getIdTokenResult(false)
      // is wrong because getIdTokenResult(false) returns the old cached result.
      let tokenResult;
      try {
        tokenResult = await currentUser.getIdTokenResult(true);
      } catch {
        // If forced refresh fails (e.g. network error), fall back to cached token.
        tokenResult = await currentUser.getIdTokenResult(false);
      }
      const claimRole = (tokenResult.claims as { role?: unknown }).role;
      const claimCompanyId = (tokenResult.claims as { companyId?: unknown }).companyId;
      if (typeof claimCompanyId === 'string') {
        setCompanyId(claimCompanyId);
      }
      if (isValidRole(claimRole)) {
        if (typeof window !== 'undefined') window.__USER_ROLE__ = claimRole;
        setRole(claimRole);
        return;
      }
      // Fallback: Firestore users doc (set by assign-admin.cjs alongside claims).
      try {
        const db = getFirestoreInstancePublic();
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        const docData = snap.exists() ? snap.data() : undefined;
        const docRole = docData?.role;
        const docCompanyId = docData?.companyId;
        if (typeof docCompanyId === 'string') {
          setCompanyId(docCompanyId);
        }
        if (isValidRole(docRole)) {
          if (typeof window !== 'undefined') window.__USER_ROLE__ = docRole;
          setRole(docRole);
          return;
        }
      } catch (docError) {
        console.warn('Role fallback to users doc failed:', docError);
      }
      console.warn('No valid role in claims or users doc; signing in as unauthorized.');
      setRole(null);
    } catch (error) {
      console.error('Failed to get user role:', error);
      setRole(null);
    }
  };

  useEffect(() => {
    const app = initializeFirebase();
    const auth = getAuth(app);
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await refreshUserRole(currentUser);
      } else {
        setRole(null);
        setCompanyId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const app = initializeFirebase();
      const auth = getAuth(app);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      setUser(credential.user);
      await refreshUserRole(credential.user);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const app = initializeFirebase();
      const auth = getAuth(app);
      await signOut(auth);
      setUser(null);
      setRole(null);
      setCompanyId(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshRole = async () => {
    if (user) {
      await refreshUserRole();
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, companyId, loading, login, logout, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRole() {
  const { role, loading } = useAuth();
  return { role, loading };
}

export function useRequireRole(allowedRoles: UserRole[]) {
  const { role, loading, user } = useAuth();
  
  if (loading) {
    return { authorized: false, loading: true, role: null };
  }
  
  if (!user) {
    return { authorized: false, loading: false, role: null };
  }
  
  const authorized = role !== null && allowedRoles.includes(role);
  return { authorized, loading: false, role };
}