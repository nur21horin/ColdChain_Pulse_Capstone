'use client';

// React binding for the outbox: tracks connectivity, syncs on `online`, on mount
// and every 30 s, and exposes what the ConnectionBanner needs (OFF-3, OFF-4).

import { useCallback, useEffect, useRef, useState } from 'react';
import { sendOutboxItem } from '@/lib/api/client';
import { hasIndexedDb, idbOutboxStore } from './idb';
import { MemoryStore, Outbox, type OutboxItem } from './outbox';

export type ConnectionStatus = 'online' | 'offline' | 'syncing';

let shared: Outbox | null = null;
export function getOutbox(): Outbox {
  shared ??= new Outbox(hasIndexedDb() ? idbOutboxStore : new MemoryStore());
  return shared;
}

const SYNC_EVERY_MS = 30_000;

export function useOutbox() {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const list = await getOutbox().list();
    if (mounted.current) setItems(list);
  }, []);

  const sync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    setSyncing(true);
    try {
      await getOutbox().flush(sendOutboxItem);
    } finally {
      if (mounted.current) setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  const enqueue = useCallback(
    async (input: Parameters<Outbox['enqueue']>[0]) => {
      await getOutbox().enqueue(input);
      await refresh();
      void sync();
    },
    [refresh, sync],
  );

  const retry = useCallback(
    async (id: string) => {
      await getOutbox().retry(id);
      await sync();
    },
    [sync],
  );

  const discard = useCallback(
    async (id: string) => {
      await getOutbox().discard(id);
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    mounted.current = true;
    setOnline(navigator.onLine);
    const goOnline = () => {
      setOnline(true);
      void sync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    void refresh().then(sync);
    const timer = window.setInterval(() => void sync(), SYNC_EVERY_MS);
    return () => {
      mounted.current = false;
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.clearInterval(timer);
    };
  }, [refresh, sync]);

  const pending = items.filter((i) => i.status === 'pending');
  const needsAttention = items.filter((i) => i.status === 'needs_attention');
  const status: ConnectionStatus = !online ? 'offline' : syncing && pending.length > 0 ? 'syncing' : 'online';

  return { status, online, pending, needsAttention, enqueue, retry, discard, sync };
}
