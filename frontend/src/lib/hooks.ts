'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSession, onSessionChange } from '@/lib/session';
import type { Session } from '@/types/domain';

/** Current session, kept in sync across components. `undefined` until read on the client. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    setSession(getSession());
    return onSessionChange(setSession);
  }, []);
  return session;
}

export type AsyncState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: T; error: Error };

/**
 * Loads data and, if `intervalMs` is set, keeps polling it. On a failed poll the
 * last good data is kept so the screen shows a stale copy instead of going blank.
 */
export function usePolling<T>(load: () => Promise<T>, intervalMs?: number, deps: readonly unknown[] = []) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async () => {
    try {
      const data = await loadRef.current();
      setState({ status: 'success', data });
      setUpdatedAt(Date.now());
    } catch (err) {
      setState((prev) => ({ status: 'error', data: prev.data, error: err instanceof Error ? err : new Error(String(err)) }));
    }
  }, []);

  useEffect(() => {
    setState({ status: 'loading' });
    void run();
    if (!intervalMs) return;
    const id = window.setInterval(() => void run(), intervalMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, intervalMs, ...deps]);

  return { ...state, updatedAt, reload: run };
}

/** Re-renders every `ms` so "x s ago" labels and breach timers tick. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}
