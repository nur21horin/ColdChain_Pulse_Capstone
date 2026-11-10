import { describe, expect, it } from 'vitest';
import { classify, displayLevel, evaluate, isStale } from './alerts';

const T0 = Date.parse('2026-11-10T04:00:00Z');
const at = (sec: number) => new Date(T0 + sec * 1000).toISOString();
const MIN = 2;
const MAX = 8;

describe('classify', () => {
  it('treats readings exactly on the limits as in range', () => {
    expect(classify(2, MIN, MAX)).toBe('NEAR_LIMIT');
    expect(classify(8, MIN, MAX)).toBe('NEAR_LIMIT');
  });
  it('flags readings within 0.5 °C of a limit', () => {
    expect(classify(7.6, MIN, MAX)).toBe('NEAR_LIMIT');
    expect(classify(2.4, MIN, MAX)).toBe('NEAR_LIMIT');
  });
  it('is normal in the safe middle band', () => {
    expect(classify(2.5, MIN, MAX)).toBe('NORMAL');
    expect(classify(5, MIN, MAX)).toBe('NORMAL');
    expect(classify(7.5, MIN, MAX)).toBe('NORMAL');
  });
  it('is a breach outside the range', () => {
    expect(classify(8.01, MIN, MAX)).toBe('BREACH');
    expect(classify(1.99, MIN, MAX)).toBe('BREACH');
  });
});

describe('evaluate', () => {
  it('stays WARNING for a breach of 9 min 59 s', () => {
    const r = evaluate([{ recordedAt: at(0), tempC: 9 }, { recordedAt: at(599), tempC: 9.2 }], MIN, MAX);
    expect(r.level).toBe('WARNING');
    expect(r.outOfRangeSince).toBe(at(0));
  });

  it('does not fire CRITICAL at exactly 10 min', () => {
    const r = evaluate([{ recordedAt: at(0), tempC: 9 }, { recordedAt: at(600), tempC: 9 }], MIN, MAX);
    expect(r.level).toBe('WARNING');
  });

  it('fires CRITICAL for a breach of 10 min 01 s', () => {
    const r = evaluate([{ recordedAt: at(0), tempC: 9 }, { recordedAt: at(601), tempC: 9 }], MIN, MAX);
    expect(r.level).toBe('CRITICAL');
  });

  it('resets the episode on any in-range reading', () => {
    const r = evaluate(
      [
        { recordedAt: at(0), tempC: 9 },
        { recordedAt: at(300), tempC: 5 },
        { recordedAt: at(330), tempC: 9 },
        { recordedAt: at(900), tempC: 9 },
      ],
      MIN,
      MAX,
    );
    expect(r.level).toBe('WARNING');
    expect(r.outOfRangeSince).toBe(at(330));
  });

  it('orders late readings from an offline queue by recordedAt', () => {
    const r = evaluate(
      [
        { recordedAt: at(660), tempC: 9 },
        { recordedAt: at(0), tempC: 9 },
        { recordedAt: at(330), tempC: 9.1 },
      ],
      MIN,
      MAX,
    );
    expect(r.level).toBe('CRITICAL');
    expect(r.outOfRangeSince).toBe(at(0));
  });

  it('keeps the breach timer running across a data gap', () => {
    const r = evaluate([{ recordedAt: at(0), tempC: 1.2 }, { recordedAt: at(720), tempC: 1.4 }], MIN, MAX);
    expect(r.level).toBe('CRITICAL');
  });

  it('is NORMAL with no readings', () => {
    expect(evaluate([], MIN, MAX).level).toBe('NORMAL');
  });
});

describe('staleness', () => {
  const now = T0 + 100_000;
  it('is stale after 90 s without data', () => {
    expect(isStale(at(0), now)).toBe(true);
    expect(isStale(at(20), now)).toBe(false);
  });
  it('never hides a CRITICAL behind STALE', () => {
    expect(displayLevel('CRITICAL', at(0), now)).toBe('CRITICAL');
    expect(displayLevel('WARNING', at(0), now)).toBe('STALE');
    expect(displayLevel('NORMAL', at(20), now)).toBe('NORMAL');
  });
});
