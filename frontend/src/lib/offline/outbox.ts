// Offline-first outbox (PRD §10.2, stories OFF-2 and OFF-3).
// Every driver write lands here first, then syncs in order when the network allows.
// Items carry a client-generated UUID, so replaying one is always safe: the server
// dedupes on client_uuid / reading_id.

export type OutboxStatus = 'pending' | 'needs_attention';

export interface OutboxItem {
  clientUuid: string;
  /** API path relative to the base URL, e.g. "/handoffs" or "/telemetry". */
  endpoint: string;
  body: unknown;
  /** Device time the action happened; sync order follows it. */
  occurredAt: string;
  /** Short human label for the "Waiting to sync" list. */
  label: string;
  attempts: number;
  nextAttemptAt: number;
  status: OutboxStatus;
  lastError?: string;
}

export interface SendResult {
  ok: boolean;
  status: number;
  message?: string;
}

export interface OutboxStore {
  all(): Promise<OutboxItem[]>;
  put(item: OutboxItem): Promise<void>;
  remove(clientUuid: string): Promise<void>;
}

/** 2 s, 4 s, 8 s … capped at 60 s. */
export function backoffMs(attempts: number): number {
  return Math.min(60_000, 2_000 * 2 ** Math.max(0, attempts - 1));
}

/** Client errors that will never succeed on retry go to "Needs attention". */
function isPermanentFailure(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 409 && status !== 429;
}

export interface FlushSummary {
  sent: number;
  failed: number;
  needsAttention: number;
  remaining: number;
}

export class Outbox {
  private flushing: Promise<FlushSummary> | null = null;

  constructor(private readonly store: OutboxStore) {}

  async enqueue(input: Pick<OutboxItem, 'clientUuid' | 'endpoint' | 'body' | 'occurredAt' | 'label'>): Promise<OutboxItem> {
    const item: OutboxItem = { ...input, attempts: 0, nextAttemptAt: 0, status: 'pending' };
    await this.store.put(item);
    return item;
  }

  async list(): Promise<OutboxItem[]> {
    const items = await this.store.all();
    return items.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  }

  async discard(clientUuid: string): Promise<void> {
    await this.store.remove(clientUuid);
  }

  /** Re-queue an item a person fixed or chose to retry. */
  async retry(clientUuid: string): Promise<void> {
    const item = (await this.store.all()).find((i) => i.clientUuid === clientUuid);
    if (item) await this.store.put({ ...item, status: 'pending', attempts: 0, nextAttemptAt: 0 });
  }

  /**
   * Send pending items oldest first. Stops at the first transient failure so the
   * server always receives actions in the order they happened. Concurrent calls
   * share one run, so a timer and an `online` event never double-send.
   */
  flush(send: (item: OutboxItem) => Promise<SendResult>, now: () => number = Date.now): Promise<FlushSummary> {
    this.flushing ??= this.run(send, now).finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async run(send: (item: OutboxItem) => Promise<SendResult>, now: () => number): Promise<FlushSummary> {
    const summary: FlushSummary = { sent: 0, failed: 0, needsAttention: 0, remaining: 0 };
    const items = await this.list();

    for (const item of items) {
      if (item.status !== 'pending') {
        summary.needsAttention += 1;
        continue;
      }
      if (item.nextAttemptAt > now()) {
        summary.remaining += 1;
        break;
      }

      let result: SendResult;
      try {
        result = await send(item);
      } catch (err) {
        result = { ok: false, status: 0, message: err instanceof Error ? err.message : 'Network error' };
      }

      // 409 = server already has this UUID: the earlier attempt landed.
      if (result.ok || result.status === 409) {
        await this.store.remove(item.clientUuid);
        summary.sent += 1;
        continue;
      }

      const attempts = item.attempts + 1;
      if (isPermanentFailure(result.status)) {
        await this.store.put({ ...item, attempts, status: 'needs_attention', lastError: result.message ?? `HTTP ${result.status}` });
        summary.needsAttention += 1;
        continue;
      }

      await this.store.put({ ...item, attempts, nextAttemptAt: now() + backoffMs(attempts), lastError: result.message });
      summary.failed += 1;
      break;
    }

    const after = await this.store.all();
    summary.remaining = after.filter((i) => i.status === 'pending').length;
    summary.needsAttention = after.filter((i) => i.status === 'needs_attention').length;
    return summary;
  }
}

/** In-memory store: used by tests and as a fallback when IndexedDB is unavailable. */
export class MemoryStore implements OutboxStore {
  private items = new Map<string, OutboxItem>();
  async all() {
    return [...this.items.values()];
  }
  async put(item: OutboxItem) {
    this.items.set(item.clientUuid, item);
  }
  async remove(id: string) {
    this.items.delete(id);
  }
}
