// Mock backend for NEXT_PUBLIC_API_MODE=mock.
// Generates 512 active shipments with deterministic temperature profiles, runs
// them through the same alert rules as the server (src/lib/alerts.ts), and
// builds hash-chained batch reports. Never used when API mode is "live".

import { displayLevel, evaluate } from '@/lib/alerts';
import type { OutboxItem, SendResult } from '@/lib/offline/outbox';
import type {
  Alert,
  AuditEvent,
  BatchListItem,
  BatchReport,
  IntegrityResult,
  NewShipmentInput,
  Reading,
  Session,
  Shipment,
  User,
} from '@/types/domain';
import { ApiError } from './errors';

const STEP_MS = 30_000;
const MIN = 60_000;
const BOOT = Date.now();

// ---------- deterministic helpers ----------

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T;
const round1 = (n: number) => Math.round(n * 10) / 10;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CLINICS = [
  ['Sreepur UHC', 'Gazipur'],
  ['Kalihati UHC', 'Tangail'],
  ['Mirzapur Clinic', 'Tangail'],
  ['Gazipur Sadar', 'Gazipur'],
  ['Kaliakair UHC', 'Gazipur'],
  ['Savar UHC', 'Dhaka'],
  ['Dhamrai UHC', 'Dhaka'],
  ['Kapasia UHC', 'Gazipur'],
  ['Madhupur UHC', 'Tangail'],
  ['Manikganj Sadar', 'Manikganj'],
  ['Singair UHC', 'Manikganj'],
  ['Narsingdi Sadar', 'Narsingdi'],
] as const;
const PRODUCTS = ['BCG vaccine', 'Pentavalent', 'MR vaccine', 'OPV', 'Hepatitis B', 'TT vaccine', 'PCV', 'Rota vaccine', 'Insulin glargine'] as const;
const DRIVERS = ['M. Karim', 'S. Akter', 'R. Hossain', 'T. Islam', 'A. Rahman', 'N. Sultana', 'F. Ahmed', 'J. Uddin', 'H. Begum', 'K. Mia', 'L. Khatun', 'P. Sarker'] as const;

type Profile = 'normal' | 'warnHigh' | 'warnLow' | 'critHigh' | 'critLow' | 'stale';

interface MockShipment extends Omit<Shipment, 'state'> {
  profile: Profile;
  phase: number;
  base: number;
  breachStart: number;
  staleSince: number;
}

function profileFor(i: number): Profile {
  if (i === 0 || i === 1) return i === 0 ? 'critHigh' : 'critLow';
  if (i >= 2 && i <= 8) return i % 2 === 0 ? 'warnHigh' : 'warnLow';
  if (i >= 9 && i <= 11) return 'stale';
  return 'normal';
}

const FEATURED_IDS = ['SHP-0142', 'SHP-0377', 'SHP-0218', 'SHP-0409', 'SHP-0055', 'SHP-0461', 'SHP-0133', 'SHP-0482', 'SHP-0019', 'SHP-0311', 'SHP-0390', 'SHP-0277', 'SHP-0204'];

function buildFleet(): MockShipment[] {
  const rand = mulberry32(41_2);
  const fleet: MockShipment[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 512; i++) {
    let id = FEATURED_IDS[i];
    if (!id) {
      do id = `SHP-${String(1000 + Math.floor(rand() * 9000))}`;
      while (used.has(id));
    }
    used.add(id);
    const [clinicName, district] = pick(rand, CLINICS);
    const profile = profileFor(i);
    const distance = Math.round(5 + rand() * 70);
    fleet.push({
      id,
      batchNo: `${pick(rand, ['BCG', 'PEN', 'MRV', 'OPV', 'HPB'])}-2611-${String(1 + Math.floor(rand() * 20)).padStart(2, '0')}`,
      product: i === 1 ? 'Insulin glargine' : pick(rand, PRODUCTS),
      originName: 'Tejgaon Central Warehouse',
      clinicName,
      district,
      driverName: pick(rand, DRIVERS),
      vehiclePlate: `DHK-${10 + Math.floor(rand() * 6)}-${String(Math.floor(rand() * 9999)).padStart(4, '0')}`,
      minTempC: 2,
      maxTempC: 8,
      status: 'IN_TRANSIT',
      qrToken: id.replace('SHP-', 'QR') + 'X'.repeat(2),
      etaAt: null,
      distanceLeftKm: distance,
      profile,
      phase: rand() * Math.PI * 2,
      base: 4.4 + rand() * 1.4,
      breachStart: BOOT - (profile === 'critHigh' ? 11.5 : 10.8) * MIN,
      staleSince: BOOT - (2 + rand() * 2) * MIN,
    });
  }
  return fleet;
}

const fleet = buildFleet();
const created: MockShipment[] = [];
const acked = new Map<string, string>();

function tempAt(s: MockShipment, t: number): number {
  const wobble = 0.25 * Math.sin(s.phase + t / (7 * MIN));
  switch (s.profile) {
    case 'normal':
    case 'stale':
      return s.base + wobble;
    case 'warnHigh':
      return 7.65 + 0.12 * Math.sin(s.phase + t / (3 * MIN));
    case 'warnLow':
      return 2.3 + 0.1 * Math.sin(s.phase + t / (3 * MIN));
    case 'critHigh': {
      if (t < s.breachStart) return 7.95 - Math.min(2.5, (s.breachStart - t) / (8 * MIN));
      return 8.3 + Math.min(1.3, ((t - s.breachStart) / (12 * MIN)) * 1.1) + 0.05 * Math.sin(t / MIN);
    }
    case 'critLow': {
      if (t < s.breachStart) return 2.05 + Math.min(2.5, (s.breachStart - t) / (8 * MIN));
      return 1.7 - Math.min(0.7, ((t - s.breachStart) / (12 * MIN)) * 0.6);
    }
  }
}

function readingsFor(s: MockShipment, now: number, count = 60): Reading[] {
  const end = s.profile === 'stale' ? s.staleSince : now;
  const last = Math.floor(end / STEP_MS) * STEP_MS;
  const out: Reading[] = [];
  for (let k = count - 1; k >= 0; k--) {
    const t = last - k * STEP_MS;
    out.push({
      readingId: `${s.id}-${t}`,
      shipmentId: s.id,
      recordedAt: new Date(t).toISOString(),
      tempC: round1(tempAt(s, t)),
      humidityPct: 58 + Math.round(4 * Math.sin(s.phase + t / (11 * MIN))),
      lat: null,
      lng: null,
    });
  }
  return out;
}

function materialise(s: MockShipment, now: number): Shipment {
  const { profile: _p, phase: _ph, base: _b, breachStart: _bs, staleSince: _ss, ...rest } = s;
  if (s.status === 'CREATED' || s.status === 'ASSIGNED') {
    return {
      ...rest,
      state: { lastReadingAt: null, lastTempC: null, humidityPct: null, outOfRangeSince: null, alertLevel: 'STALE', recentTemps: [] },
    };
  }
  const readings = readingsFor(s, now);
  const ep = evaluate(readings, s.minTempC, s.maxTempC);
  const last = readings[readings.length - 1];
  const etaMs = s.distanceLeftKm === null ? null : now + (s.distanceLeftKm / 40) * 3_600_000;
  return {
    ...rest,
    etaAt: etaMs === null ? null : new Date(Math.round(etaMs / MIN) * MIN).toISOString(),
    state: {
      lastReadingAt: last?.recordedAt ?? null,
      lastTempC: last?.tempC ?? null,
      humidityPct: last?.humidityPct ?? null,
      outOfRangeSince: ep.outOfRangeSince,
      alertLevel: displayLevel(ep.level, last?.recordedAt ?? null, now),
      recentTemps: readings.map((r) => r.tempC),
    },
  };
}

// ---------- auth ----------

const DEMO_PASSWORD = 'demo1234';
const USERS: Record<string, User & { shipmentId?: string }> = {
  'admin@demo.coldchain': { id: 'u-admin', email: 'admin@demo.coldchain', name: 'Admin', role: 'ADMIN' },
  'dispatch@demo.coldchain': { id: 'u-disp', email: 'dispatch@demo.coldchain', name: 'Dispatcher', role: 'DISPATCHER' },
  'driver@demo.coldchain': { id: 'u-drv', email: 'driver@demo.coldchain', name: 'J. Uddin', role: 'DRIVER', shipmentId: 'SHP-0204' },
  'driver2@demo.coldchain': { id: 'u-drv2', email: 'driver2@demo.coldchain', name: 'M. Karim', role: 'DRIVER', shipmentId: 'SHP-0142' },
  'clinic@demo.coldchain': { id: 'u-rcv', email: 'clinic@demo.coldchain', name: 'Kapasia UHC', role: 'CLINIC_RECEIVER', shipmentId: 'SHP-0204' },
  'auditor@demo.coldchain': { id: 'u-aud', email: 'auditor@demo.coldchain', name: 'External Auditor', role: 'AUDITOR' },
};

const failures = new Map<string, number[]>();
const LOCK_WINDOW = 15 * MIN;
const MAX_FAILS = 5;

export async function login(email: string, password: string): Promise<Session> {
  await sleep(350);
  const key = email.trim().toLowerCase();
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((t) => now - t < LOCK_WINDOW);
  if (recent.length >= MAX_FAILS) {
    const retryAfter = Math.ceil((LOCK_WINDOW - (now - (recent[0] ?? now))) / 1000);
    throw new ApiError(423, 'LOCKED', 'Too many failed attempts. Try again in 15 minutes.', { retry_after_s: retryAfter });
  }
  const user = USERS[key];
  if (!user || password !== DEMO_PASSWORD) {
    recent.push(now);
    failures.set(key, recent);
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is wrong.', { attempts_left: MAX_FAILS - recent.length });
  }
  failures.delete(key);
  const { shipmentId: _s, ...publicUser } = user;
  return { token: `mock.${user.id}.${now}`, user: publicUser, expiresAt: new Date(now + 8 * 3_600_000).toISOString() };
}

function shipmentIdFor(session: Session | null): string | undefined {
  return session ? USERS[session.user.email]?.shipmentId : undefined;
}

// ---------- shipments & alerts ----------

export async function listShipments(scope: 'all' | 'mine', session: Session | null): Promise<Shipment[]> {
  await sleep(150);
  const now = Date.now();
  if (scope === 'mine') {
    const id = shipmentIdFor(session);
    return fleet.filter((s) => s.id === id).map((s) => materialise(s, now));
  }
  return [...created, ...fleet].map((s) => materialise(s, now));
}

export async function getShipment(id: string): Promise<Shipment> {
  await sleep(100);
  const s = [...created, ...fleet].find((x) => x.id === id);
  if (!s) throw new ApiError(404, 'NOT_FOUND', `Shipment ${id} not found`);
  return materialise(s, Date.now());
}

export async function createShipment(input: NewShipmentInput): Promise<Shipment> {
  await sleep(300);
  const id = `SHP-${String(9000 + created.length + 1)}`;
  const s: MockShipment = {
    id,
    batchNo: input.batchNo,
    product: input.product,
    originName: input.originName,
    clinicName: input.clinicName,
    district: '—',
    driverName: null,
    vehiclePlate: null,
    minTempC: input.minTempC,
    maxTempC: input.maxTempC,
    status: 'CREATED',
    qrToken: `QR${Date.now().toString(36).toUpperCase()}`,
    etaAt: null,
    distanceLeftKm: null,
    profile: 'normal',
    phase: 0,
    base: (input.minTempC + input.maxTempC) / 2,
    breachStart: 0,
    staleSince: 0,
  };
  created.unshift(s);
  return materialise(s, Date.now());
}

export async function listAlerts(params: { level?: 'CRITICAL' | 'WARNING'; shipmentId?: string }): Promise<Alert[]> {
  await sleep(100);
  const now = Date.now();
  const alerts: Alert[] = [];
  for (const s of fleet) {
    if (params.shipmentId && s.id !== params.shipmentId) continue;
    if (s.profile !== 'critHigh' && s.profile !== 'critLow' && s.profile !== 'warnHigh' && s.profile !== 'warnLow') continue;
    const sh = materialise(s, now);
    const t = sh.state.lastTempC ?? 0;
    const high = s.profile === 'critHigh' || s.profile === 'warnHigh';
    const limit = high ? s.maxTempC : s.minTempC;
    if (s.profile === 'critHigh' || s.profile === 'critLow') {
      const crit = `ALR-${s.id}-C`;
      alerts.push({
        id: crit,
        shipmentId: s.id,
        level: 'CRITICAL',
        episodeStart: new Date(s.breachStart).toISOString(),
        triggeredAt: new Date(s.breachStart + 10 * MIN + STEP_MS).toISOString(),
        peakTempC: t,
        message: `${high ? 'Above' : 'Below'} ${limit.toFixed(1)} °C for more than 10 min`,
        acknowledgedAt: acked.get(crit) ?? null,
      });
      const warn = `ALR-${s.id}-W`;
      alerts.push({
        id: warn,
        shipmentId: s.id,
        level: 'WARNING',
        episodeStart: new Date(s.breachStart).toISOString(),
        triggeredAt: new Date(s.breachStart).toISOString(),
        peakTempC: t,
        message: 'Breach started',
        acknowledgedAt: acked.get(warn) ?? null,
      });
    } else {
      const warn = `ALR-${s.id}-W`;
      alerts.push({
        id: warn,
        shipmentId: s.id,
        level: 'WARNING',
        episodeStart: new Date(BOOT - 4 * MIN).toISOString(),
        triggeredAt: new Date(BOOT - 4 * MIN).toISOString(),
        peakTempC: t,
        message: `Within 0.5 °C of ${high ? 'max' : 'min'}`,
        acknowledgedAt: acked.get(warn) ?? null,
      });
    }
  }
  return alerts
    .filter((a) => !params.level || a.level === params.level)
    .sort((a, b) => (a.level === b.level ? Date.parse(b.triggeredAt) - Date.parse(a.triggeredAt) : a.level === 'CRITICAL' ? -1 : 1));
}

export async function ackAlert(id: string): Promise<Alert> {
  await sleep(200);
  acked.set(id, new Date().toISOString());
  const all = await listAlerts({});
  const a = all.find((x) => x.id === id);
  if (!a) throw new ApiError(404, 'NOT_FOUND', 'Alert not found');
  return a;
}

// ---------- driver outbox ----------

export async function acceptOutboxItem(item: OutboxItem): Promise<SendResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Offline');
  await sleep(400);
  const body = item.body as { pin?: string };
  if (item.endpoint === '/handoffs' && body.pin === '0000') return { ok: false, status: 422, message: 'Wrong PIN' };
  return { ok: true, status: 201 };
}

// ---------- audit ----------

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface BatchDef {
  shipmentId: string;
  batchNo: string;
  clinicName: string;
  vehiclePlate: string;
  pickup: string;
  delivered: string;
  excursion: { startMin: number; minutes: number; peak: number } | null;
  warnings: number;
  flag: BatchListItem['flag'];
}

const BATCHES: BatchDef[] = [
  {
    shipmentId: 'SHP-0117',
    batchNo: 'BCG-2611-03',
    clinicName: 'Kapasia UHC',
    vehiclePlate: 'DHK-12-4471',
    pickup: '2026-11-09T02:12:00Z',
    delivered: '2026-11-09T08:26:00Z',
    excursion: { startMin: 188, minutes: 14, peak: 9.1 },
    warnings: 0,
    flag: { level: 'CRITICAL', label: '1 critical' },
  },
  {
    shipmentId: 'SHP-0098',
    batchNo: 'BCG-2611-02',
    clinicName: 'Sreepur UHC',
    vehiclePlate: 'DHK-11-2041',
    pickup: '2026-11-07T03:05:00Z',
    delivered: '2026-11-07T07:40:00Z',
    excursion: null,
    warnings: 2,
    flag: { level: 'WARNING', label: '2 warnings' },
  },
  {
    shipmentId: 'SHP-0071',
    batchNo: 'BCG-2611-01',
    clinicName: 'Savar UHC',
    vehiclePlate: 'DHK-13-7702',
    pickup: '2026-11-04T02:30:00Z',
    delivered: '2026-11-04T09:55:00Z',
    excursion: null,
    warnings: 0,
    flag: { level: 'WARNING', label: 'late delivery' },
  },
  {
    shipmentId: 'SHP-0064',
    batchNo: 'BCG-2611-01',
    clinicName: 'Dhamrai UHC',
    vehiclePlate: 'DHK-11-6013',
    pickup: '2026-11-03T02:50:00Z',
    delivered: '2026-11-03T06:15:00Z',
    excursion: null,
    warnings: 1,
    flag: { level: 'WARNING', label: '1 warning' },
  },
];

const tampered = new Set<string>();
const reportCache = new Map<string, Promise<BatchReport>>();

export async function listBatches(): Promise<BatchListItem[]> {
  await sleep(150);
  return BATCHES.map((b) => ({ shipmentId: b.shipmentId, batchNo: b.batchNo, clinicName: b.clinicName, deliveredAt: b.delivered, flag: b.flag }));
}

async function buildReport(def: BatchDef): Promise<BatchReport> {
  const start = Date.parse(def.pickup);
  const end = Date.parse(def.delivered);
  const rand = mulberry32(def.shipmentId.length * 7919 + start / 1e7);
  const readings: Reading[] = [];
  for (let t = start; t <= end; t += STEP_MS) {
    const minute = (t - start) / MIN;
    let temp = 5.2 + 1.1 * Math.sin(minute / 47) + (rand() - 0.5) * 0.3;
    const ex = def.excursion;
    if (ex) {
      const rel = minute - ex.startMin;
      if (rel > -25 && rel < 0) temp = 6.8 + ((rel + 25) / 25) * 1.4;
      else if (rel >= 0 && rel <= ex.minutes) temp = 8.2 + (ex.peak - 8.2) * Math.sin((Math.PI * rel) / ex.minutes);
      else if (rel > ex.minutes && rel < ex.minutes + 30) temp = 7.6 - ((rel - ex.minutes) / 30) * 2.2;
    }
    readings.push({
      readingId: `${def.shipmentId}-${t}`,
      shipmentId: def.shipmentId,
      recordedAt: new Date(t).toISOString(),
      tempC: round1(Math.max(3.9, temp)),
      humidityPct: 60,
      lat: null,
      lng: null,
    });
  }

  const ep = def.excursion;
  const iso = (min: number) => new Date(start + min * MIN).toISOString();
  const rawEvents: Omit<AuditEvent, 'hash'>[] = [
    { at: def.pickup, kind: 'PICKUP', title: 'Pickup signed', detail: 'QR + driver PIN · synced 19 min later (was offline)', by: `Driver · ${def.vehiclePlate}`, lat: 23.759, lng: 90.392, condition: 'OK' },
  ];
  if (ep) {
    rawEvents.push(
      { at: iso(ep.startMin), kind: 'WARNING', title: 'Warning', detail: 'Breach started · 8.3 °C', by: 'Alert engine', lat: 23.962, lng: 90.471, condition: null },
      { at: iso(ep.startMin + 10.5), kind: 'CRITICAL', title: 'Critical alert', detail: `Out of range 10 min+ · peak ${ep.peak} °C`, by: 'Alert engine', lat: 23.981, lng: 90.493, condition: null },
      { at: iso(ep.startMin + 14), kind: 'ACK', title: 'Alert acknowledged', detail: '"Door seal reset, reefer back to 5 °C"', by: 'Dispatcher', lat: null, lng: null, condition: null },
    );
  }
  for (let w = 0; w < def.warnings; w++) {
    rawEvents.push({ at: iso(60 + w * 70), kind: 'WARNING', title: 'Warning', detail: 'Within 0.5 °C of max', by: 'Alert engine', lat: null, lng: null, condition: null });
  }
  rawEvents.push({
    at: def.delivered,
    kind: 'DELIVERY',
    title: 'Delivery signed',
    detail: 'QR + driver PIN + receiver PIN',
    by: `Clinic receiver · ${def.clinicName}`,
    lat: 24.104,
    lng: 90.571,
    condition: ep ? 'TEMP_SUSPECT' : 'OK',
  });
  rawEvents.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  // Hash chain over readings and events in time order (PRD NFR-2).
  let prev = '0'.repeat(64);
  for (const r of readings) prev = await sha256Hex(prev + JSON.stringify(r));
  const events: AuditEvent[] = [];
  for (const e of rawEvents) {
    prev = await sha256Hex(prev + JSON.stringify(e));
    events.push({ ...e, hash: prev });
  }

  const temps = readings.map((r) => r.tempC);
  const outOfRange = readings.filter((r) => r.tempC > 8 || r.tempC < 2).length * 0.5;
  const shipment: Shipment = {
    id: def.shipmentId,
    batchNo: def.batchNo,
    product: 'BCG vaccine',
    originName: 'Tejgaon Central Warehouse',
    clinicName: def.clinicName,
    district: 'Gazipur',
    driverName: null,
    vehiclePlate: def.vehiclePlate,
    minTempC: 2,
    maxTempC: 8,
    status: 'DELIVERED',
    qrToken: '',
    etaAt: null,
    distanceLeftKm: 0,
    state: { lastReadingAt: def.delivered, lastTempC: temps[temps.length - 1] ?? null, humidityPct: 60, outOfRangeSince: null, alertLevel: 'NORMAL', recentTemps: [] },
  };

  return {
    shipment,
    deliveredAt: def.delivered,
    readings,
    events: events.reverse(),
    summary: {
      transitMinutes: (end - start) / MIN,
      readingCount: readings.length,
      minTempC: Math.min(...temps),
      maxTempC: Math.max(...temps),
      outOfRangeMinutes: outOfRange,
      slaBreaches: ep ? 1 : def.flag?.label === 'late delivery' ? 1 : 0,
    },
    integrity: { valid: true, records: readings.length + events.length, finalHash: prev, brokenAt: null, verifiedAt: new Date().toISOString() },
  };
}

export async function getBatchReport(shipmentId: string): Promise<BatchReport> {
  const def = BATCHES.find((b) => b.shipmentId === shipmentId);
  if (!def) throw new ApiError(404, 'NOT_FOUND', `No report for ${shipmentId}`);
  if (!reportCache.has(shipmentId)) reportCache.set(shipmentId, buildReport(def));
  const report = await reportCache.get(shipmentId)!;
  return tampered.has(shipmentId) ? { ...report, integrity: await verifyReport(shipmentId) } : report;
}

/** Recomputes the chain. In mock mode, "tampering" edits one stored reading first. */
export async function verifyReport(shipmentId: string): Promise<IntegrityResult> {
  await sleep(600);
  const def = BATCHES.find((b) => b.shipmentId === shipmentId);
  if (!def) throw new ApiError(404, 'NOT_FOUND', `No report for ${shipmentId}`);
  if (!reportCache.has(shipmentId)) reportCache.set(shipmentId, buildReport(def));
  const report = await reportCache.get(shipmentId)!;
  const TAMPER_ROW = 214;
  const readings = report.readings.map((r, i) => (tampered.has(shipmentId) && i === TAMPER_ROW ? { ...r, tempC: 5.0 } : r));

  let prev = '0'.repeat(64);
  for (const r of readings) prev = await sha256Hex(prev + JSON.stringify(r));
  for (const e of [...report.events].reverse()) {
    const { hash: _hash, ...rest } = e;
    prev = await sha256Hex(prev + JSON.stringify(rest));
  }

  const valid = prev === report.integrity.finalHash;
  const broken = readings[TAMPER_ROW];
  return {
    valid,
    records: report.integrity.records,
    finalHash: report.integrity.finalHash,
    brokenAt: valid || !broken ? null : `row ${TAMPER_ROW + 1} · reading at ${broken.recordedAt}`,
    verifiedAt: new Date().toISOString(),
  };
}

/** Demo only: simulates an auditor editing one exported value (PRD demo step 7). */
export function tamper(shipmentId: string): void {
  tampered.add(shipmentId);
}

export async function reportDownload(shipmentId: string, format: 'csv' | 'pdf'): Promise<{ url: string; filename: string; revoke: () => void }> {
  const report = await getBatchReport(shipmentId);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['record', 'time_utc', 'temp_c', 'detail', 'by', 'condition', 'hash'].join(',')];
  let prev = '0'.repeat(64);
  for (const r of report.readings) {
    prev = await sha256Hex(prev + JSON.stringify(r));
    lines.push(['READING', r.recordedAt, r.tempC, '', 'sensor', '', prev].map(esc).join(','));
  }
  for (const e of [...report.events].reverse()) lines.push([e.kind, e.at, '', e.detail, e.by, e.condition ?? '', e.hash].map(esc).join(','));
  lines.push(['FINAL_HASH', report.integrity.verifiedAt, '', '', '', '', report.integrity.finalHash].map(esc).join(','));
  const body = format === 'csv' ? lines.join('\n') : `ColdChain Pulse batch report ${shipmentId}\n\nPDF export is generated by the server (pdfkit) in live mode.\n\n${lines.join('\n')}`;
  const blob = new Blob([body], { type: format === 'csv' ? 'text/csv' : 'text/plain' });
  const url = URL.createObjectURL(blob);
  return { url, filename: `${shipmentId}-report.${format === 'csv' ? 'csv' : 'txt'}`, revoke: () => URL.revokeObjectURL(url) };
}
