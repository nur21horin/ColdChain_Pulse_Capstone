// Domain types shared by every screen. Field names are camelCase on the client;
// the API client (src/lib/api/schemas.ts) maps the snake_case wire format from PRD §9.

export type Role = 'ADMIN' | 'DISPATCHER' | 'DRIVER' | 'CLINIC_RECEIVER' | 'AUDITOR';

/** What a shipment row shows. STALE = no reading for 90 s+ (PRD §10.1). */
export type AlertLevel = 'CRITICAL' | 'WARNING' | 'NORMAL' | 'STALE';

export type ShipmentStatus = 'CREATED' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'REJECTED';

export type Condition = 'OK' | 'TEMP_SUSPECT' | 'DAMAGED';

export type HandoffType = 'PICKUP' | 'DELIVERY';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Session {
  token: string;
  user: User;
  expiresAt: string;
}

export interface ShipmentState {
  lastReadingAt: string | null;
  lastTempC: number | null;
  humidityPct: number | null;
  outOfRangeSince: string | null;
  alertLevel: AlertLevel;
  /** Last ~30 minutes of readings, oldest first, for sparklines. */
  recentTemps: number[];
}

export interface Shipment {
  id: string;
  batchNo: string;
  product: string;
  originName: string;
  clinicName: string;
  district: string;
  driverName: string | null;
  vehiclePlate: string | null;
  minTempC: number;
  maxTempC: number;
  status: ShipmentStatus;
  qrToken: string;
  etaAt: string | null;
  distanceLeftKm: number | null;
  state: ShipmentState;
}

export interface Reading {
  readingId: string;
  shipmentId: string;
  recordedAt: string;
  tempC: number;
  humidityPct: number | null;
  lat: number | null;
  lng: number | null;
}

export interface Alert {
  id: string;
  shipmentId: string;
  level: 'WARNING' | 'CRITICAL';
  episodeStart: string;
  triggeredAt: string;
  peakTempC: number;
  message: string;
  acknowledgedAt: string | null;
}

export interface Handoff {
  clientUuid: string;
  shipmentId: string;
  type: HandoffType;
  actorLabel: string;
  occurredAt: string;
  syncedAt: string | null;
  lat: number | null;
  lng: number | null;
  condition: Condition;
  hash: string | null;
}

/** Entry in the auditor's custody & alert log (handoffs, alerts and acks merged). */
export interface AuditEvent {
  at: string;
  kind: 'PICKUP' | 'DELIVERY' | 'WARNING' | 'CRITICAL' | 'ACK';
  title: string;
  detail: string;
  by: string;
  lat: number | null;
  lng: number | null;
  condition: Condition | null;
  hash: string;
}

export interface IntegrityResult {
  valid: boolean;
  records: number;
  finalHash: string;
  brokenAt: string | null;
  verifiedAt: string;
}

export interface BatchReport {
  shipment: Shipment;
  deliveredAt: string | null;
  readings: Reading[];
  events: AuditEvent[];
  summary: {
    transitMinutes: number;
    readingCount: number;
    minTempC: number;
    maxTempC: number;
    outOfRangeMinutes: number;
    slaBreaches: number;
  };
  integrity: IntegrityResult;
}

export interface BatchListItem {
  shipmentId: string;
  batchNo: string;
  clinicName: string;
  deliveredAt: string;
  flag: { level: 'CRITICAL' | 'WARNING'; label: string } | null;
}

export interface NewShipmentInput {
  batchNo: string;
  product: string;
  originName: string;
  clinicName: string;
  minTempC: number;
  maxTempC: number;
}

export interface HandoffInput {
  clientUuid: string;
  shipmentId: string;
  type: HandoffType;
  qrToken: string;
  pin: string;
  condition: Condition;
  lat: number | null;
  lng: number | null;
  occurredAt: string;
}

export interface ManualReadingInput {
  readingId: string;
  shipmentId: string;
  tempC: number;
  recordedAt: string;
}
