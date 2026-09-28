import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';

const WELCOME_FLAG = 'interno:welcome';

/**
 * Set the flag BEFORE calling login() so the arm effect (user/loading
 * deps) always sees it when the session settles. Clear on login failure.
 */
export function markWelcomeShown() {
  try {
    sessionStorage.setItem(WELCOME_FLAG, '1');
  } catch {
    // sessionStorage unavailable (private mode) — welcome is skipped silently
  }
}

/** Called when login fails — no welcome for a failed sign-in. */
export function cancelWelcome() {
  clearWelcomeFlag();
}

function clearWelcomeFlag() {
  try {
    sessionStorage.removeItem(WELCOME_FLAG);
  } catch {
    // ignore
  }
}

function hasWelcomeFlag(): boolean {
  try {
    return sessionStorage.getItem(WELCOME_FLAG) === '1';
  } catch {
    return false;
  }
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  supervisor: 'Supervisor',
  coordinator: 'Coordinator',
  trainee: 'Trainee',
};

type Phase = 'idle' | 'play' | 'exit' | 'done';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Post-login brand card: logo → wordmark → greeting → hairline sweep,
 * then hands off to the dashboard underneath (Demo 2 from SAMPLE.HTML).
 * Plays once per successful login; tap or any key skips.
 */
export function WelcomeScreen() {
  const { user, role, companyId, loading } = useAuth();
  const [phase, setPhase] = useState<Phase>('idle');
  const [org, setOrg] = useState<string | null>(null);

  const active = phase === 'play' || phase === 'exit';

  // Arm: show once the flagged login resolves (or drop a stale flag on logout).
  useEffect(() => {
    if (phase !== 'idle') return;
    if (loading) return;
    if (!user) {
      if (hasWelcomeFlag()) clearWelcomeFlag();
      return;
    }
    if (hasWelcomeFlag()) setPhase('play');
  }, [phase, loading, user]);

  // Play → exit handoff.
  useEffect(() => {
    if (phase !== 'play') return;
    const handoff = prefersReducedMotion() ? 900 : 1900;
    const timer = window.setTimeout(() => setPhase('exit'), handoff);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Exit → unmount.
  useEffect(() => {
    if (phase !== 'exit') return;
    const exitDur = prefersReducedMotion() ? 0 : 340;
    const timer = window.setTimeout(() => {
      clearWelcomeFlag();
      setPhase('done');
    }, exitDur);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Skip: tap or any key.
  useEffect(() => {
    if (phase !== 'play') return;
    const skip = () => {
      clearWelcomeFlag();
      setPhase('done');
    };
    const onKey = () => skip();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  // Org name for the role line (guarded — rules allow same-company reads).
  useEffect(() => {
    if (!active || !companyId) return;
    let cancelled = false;
    getDoc(doc(getFirestoreInstancePublic(), 'companies', companyId))
      .then((snap) => {
        if (!cancelled && snap.exists()) {
          const name = (snap.data() as { name?: string }).name;
          if (name) setOrg(name);
        }
      })
      .catch(() => {
        // read denied or offline — role line falls back to the role only
      });
    return () => {
      cancelled = true;
    };
  }, [active, companyId]);

  if (phase === 'idle' || phase === 'done') return null;

  const skip = () => {
    clearWelcomeFlag();
    setPhase('done');
  };

  const rawName = user?.displayName || user?.email?.split('@')[0] || '';
  const first = rawName.split(' ')[0].trim();
  const greet = first ? `${first.charAt(0).toUpperCase()}${first.slice(1)}` : 'there';
  const roleLine = [role ? ROLE_LABEL[role] : null, org].filter(Boolean).join(' · ');

  return (
    <div
      className={`welcome fixed inset-0 z-50 ${phase === 'play' ? 'play' : 'exit'}`}
      role="status"
      aria-live="polite"
      aria-label="Welcome"
    >
      <button type="button" aria-label="Skip welcome" onClick={skip} className="absolute inset-0" />
      <div className="w-mark">
        <span className="w-halo" aria-hidden="true" />
        <img src="/interno-logo.jpg" alt="" className="w-logo" />
      </div>
      <div className="w-word">
        Inter<span>no</span>
      </div>
      <div className="w-rule" aria-hidden="true" />
      <div className="w-name">Welcome back, {greet}</div>
      {roleLine && <div className="w-role">{roleLine}</div>}
      <div className="w-hint">Preparing your dashboard…</div>
      <span className="w-bar" aria-hidden="true" />
    </div>
  );
}
