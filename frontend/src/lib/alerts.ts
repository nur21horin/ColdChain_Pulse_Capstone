// Client mirror of the alert engine in PRD §10.1.
// The server is the source of truth; this copy powers mock mode, local display
// of offline manual logs, and is unit-tested so both sides agree on the rules.

import type { AlertLevel } from '@/types/domain';

export const DEFAULT_MARGIN_C = 0.5;
export const CRITICAL_AFTER_MS = 10 * 60 * 1000;
export const STALE_AFTER_MS = 90 * 1000;

export type Zone = 'NORMAL' | 'NEAR_LIMIT' | 'BREACH';

/** A reading exactly on min or max counts as in range. */
export function classify(tempC: number, minC: number, maxC: number, marginC = DEFAULT_MARGIN_C): Zone {
  if (tempC < minC || tempC > maxC) return 'BREACH';
  if (tempC < minC + marginC || tempC > maxC - marginC) return 'NEAR_LIMIT';
  return 'NORMAL';
}

export interface TimedReading {
  recordedAt: string | number | Date;
  tempC: number;
}

export interface EpisodeResult {
  level: 'NORMAL' | 'WARNING' | 'CRITICAL';
  /** ISO time the current breach started, or null when in range. */
  outOfRangeSince: string | null;
  /** How long the current breach has lasted, in ms (0 when in range). */
  breachMs: number;
}

const toMs = (t: string | number | Date): number =>
  typeof t === 'number' ? t : t instanceof Date ? t.getTime() : Date.parse(t);

/**
 * Evaluate the alert level from a shipment's readings.
 * - Ordered by sensor recordedAt, so late readings from an offline queue slot in correctly.
 * - Critical only when the breach has lasted strictly more than 10 minutes.
 * - A gap in data during a breach does not reset the timer (conservative default).
 * - Any in-range reading ends the episode.
 */
export function evaluate(
  readings: readonly TimedReading[],
  minC: number,
  maxC: number,
  opts: { marginC?: number; criticalAfterMs?: number } = {},
): EpisodeResult {
  const marginC = opts.marginC ?? DEFAULT_MARGIN_C;
  const criticalAfterMs = opts.criticalAfterMs ?? CRITICAL_AFTER_MS;
  const sorted = [...readings].sort((a, b) => toMs(a.recordedAt) - toMs(b.recordedAt));

  let since: number | null = null;
  let level: EpisodeResult['level'] = 'NORMAL';
  let breachMs = 0;

  for (const r of sorted) {
    const t = toMs(r.recordedAt);
    const zone = classify(r.tempC, minC, maxC, marginC);
    if (zone === 'BREACH') {
      since ??= t;
      breachMs = t - since;
      level = breachMs > criticalAfterMs ? 'CRITICAL' : 'WARNING';
    } else {
      since = null;
      breachMs = 0;
      level = zone === 'NEAR_LIMIT' ? 'WARNING' : 'NORMAL';
    }
  }

  return { level, outOfRangeSince: since === null ? null : new Date(since).toISOString(), breachMs };
}

/** True when no reading has arrived for more than 90 s. */
export function isStale(lastReadingAt: string | null, now: number = Date.now()): boolean {
  if (!lastReadingAt) return true;
  return now - Date.parse(lastReadingAt) > STALE_AFTER_MS;
}

/** Critical always wins; otherwise a silent sensor is shown as STALE. */
export function displayLevel(level: EpisodeResult['level'], lastReadingAt: string | null, now: number = Date.now()): AlertLevel {
  if (level === 'CRITICAL') return 'CRITICAL';
  if (isStale(lastReadingAt, now)) return 'STALE';
  return level;
}

/** Sort order for the live board: Critical, Warning, Stale, Normal. */
export const LEVEL_RANK: Record<AlertLevel, number> = { CRITICAL: 0, WARNING: 1, STALE: 2, NORMAL: 3 };
