import { describe, expect, it } from 'vitest';
import { backoffMs, MemoryStore, Outbox, type OutboxItem, type SendResult } from './outbox';

function setup() {
  const store = new MemoryStore();
  const outbox = new Outbox(store);
  const add = (id: string, minute: number) =>
    outbox.enqueue({ clientUuid: id, endpoint: '/handoffs', body: { id }, occurredAt: `2026-11-10T04:${String(minute).padStart(2, '0')}:00Z`, label: id });
  return { store, outbox, add };
}

describe('Outbox', () => {
  it('sends oldest first and empties on success', async () => {
    const { outbox, add } = setup();
    await add('b', 5);
    await add('a', 1);
    const sent: string[] = [];
    const r = await outbox.flush(async (i) => {
      sent.push(i.clientUuid);
      return { ok: true, status: 201 };
    });
    expect(sent).toEqual(['a', 'b']);
    expect(r).toMatchObject({ sent: 2, remaining: 0 });
  });

  it('never double-sends across 3 offline/online cycles', async () => {
    const { outbox, add } = setup();
    await add('h1', 1);
    await add('h2', 2);
    await add('h3', 3);
    const serverRows = new Set<string>();
    let online = false;
    let clock = 0;
    const send = async (i: OutboxItem): Promise<SendResult> => {
      if (!online) throw new Error('offline');
      if (serverRows.has(i.clientUuid)) return { ok: false, status: 409 };
      serverRows.add(i.clientUuid);
      return { ok: true, status: 201 };
    };
    for (let cycle = 0; cycle < 3; cycle++) {
      online = false;
      await outbox.flush(send, () => clock);
      clock += 120_000;
      online = true;
      await outbox.flush(send, () => clock);
    }
    expect([...serverRows].sort()).toEqual(['h1', 'h2', 'h3']);
    expect(await outbox.list()).toHaveLength(0);
  });

  it('treats 409 as already synced', async () => {
    const { outbox, add } = setup();
    await add('x', 1);
    await outbox.flush(async () => ({ ok: false, status: 409 }));
    expect(await outbox.list()).toHaveLength(0);
  });

  it('moves validation errors to needs_attention and keeps going', async () => {
    const { outbox, add } = setup();
    await add('bad-pin', 1);
    await add('good', 2);
    const r = await outbox.flush(async (i) => (i.clientUuid === 'bad-pin' ? { ok: false, status: 422, message: 'Wrong PIN' } : { ok: true, status: 201 }));
    expect(r).toMatchObject({ sent: 1, needsAttention: 1 });
    const [left] = await outbox.list();
    expect(left?.status).toBe('needs_attention');
    expect(left?.lastError).toBe('Wrong PIN');
  });

  it('stops at the first transient failure to preserve order, then backs off', async () => {
    const { outbox, add } = setup();
    await add('first', 1);
    await add('second', 2);
    const sent: string[] = [];
    const r = await outbox.flush(async (i) => {
      sent.push(i.clientUuid);
      return { ok: false, status: 503 };
    }, () => 1_000);
    expect(sent).toEqual(['first']);
    expect(r).toMatchObject({ failed: 1, remaining: 2 });
    const [first] = await outbox.list();
    expect(first?.nextAttemptAt).toBe(1_000 + 2_000);
  });

  it('caps backoff at 60 s', () => {
    expect(backoffMs(1)).toBe(2_000);
    expect(backoffMs(2)).toBe(4_000);
    expect(backoffMs(10)).toBe(60_000);
  });
});
