'use client';

import { useEffect } from 'react';

/** Registers /sw.js so the driver app shell loads with no signal (OFF-1). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => console.warn('[sw] registration failed', err));
  }, []);
  return null;
}
