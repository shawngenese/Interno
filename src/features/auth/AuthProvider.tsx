import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { 
  type User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  getAuth 
} from 'firebase/auth';
import { initializeFirebase } from '@/config/firebase';
import { getFunctions as getFirebaseFunctions, httpsCallable } from 'firebase/functions';

export type UserRole = 'admin' | 'supervisor' | 'coordinator' | 'trainee' | null;

interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserRole = async () => {
    try {
      const app = initializeFirebase();
      const funcs = getFirebaseFunctions(app, 'asia-southeast1');
      const getCurrentUserRole = httpsCallable<unknown, { role: UserRole; claims: Record<string, unknown> }>(
        funcs,
        'getCurrentUserRole'
      );
      const result = await getCurrentUserRole();
      setRole(result.data.role);
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
        await refreshUserRole();
      } else {
        setRole(null);
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
      await signInWithEmailAndPassword(auth, email, password);
      await refreshUserRole();
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
    <AuthContext.Provider value={{ user, role, loading, login, logout, refreshRole }}>
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