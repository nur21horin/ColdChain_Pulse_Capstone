// Session storage for the signed-in user.
// MVP: token kept in sessionStorage so it dies with the tab. Phase 2: move to an
// httpOnly, Secure, SameSite=Strict cookie set by the API so scripts can't read it.

import type { Session } from '@/types/domain';

const KEY = 'ccp.session';
type Listener = (s: Session | null) => void;
const listeners = new Set<Listener>();

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (Date.parse(s.expiresAt) < Date.now()) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function setSession(s: Session | null): void {
  try {
    if (s) window.sessionStorage.setItem(KEY, JSON.stringify(s));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable (private mode); the app still works for this page view.
  }
  listeners.forEach((l) => l(s));
}

export function onSessionChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
