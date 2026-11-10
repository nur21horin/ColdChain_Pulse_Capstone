// Minimal IndexedDB wrapper with no dependencies.
// Database "coldchain-pulse": store "outbox" (queued writes) and "cache" (assigned shipments).

import type { OutboxItem, OutboxStore } from './outbox';

const DB_NAME = 'coldchain-pulse';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'clientUuid' });
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export const idbOutboxStore: OutboxStore = {
  all: () => tx<OutboxItem[]>('outbox', 'readonly', (s) => s.getAll() as IDBRequest<OutboxItem[]>),
  put: (item) => tx('outbox', 'readwrite', (s) => s.put(item)).then(() => undefined),
  remove: (id) => tx('outbox', 'readwrite', (s) => s.delete(id)).then(() => undefined),
};

export function cacheSet<T>(key: string, value: T): Promise<void> {
  return tx('cache', 'readwrite', (s) => s.put(value, key)).then(() => undefined);
}

export function cacheGet<T>(key: string): Promise<T | undefined> {
  return tx<T | undefined>('cache', 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
}

export function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}
