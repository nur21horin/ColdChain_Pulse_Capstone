// Zod schemas for the REST API wire format (PRD §9, snake_case).
// Each schema validates the response and maps it to the camelCase domain types,
// so a backend contract change fails loudly here instead of deep in a component.

import { z } from 'zod';
import type { Alert, BatchListItem, BatchReport, Handoff, IntegrityResult, Reading, Session, Shipment, User } from '@/types/domain';

const role = z.enum(['ADMIN', 'DISPATCHER', 'DRIVER', 'CLINIC_RECEIVER', 'AUDITOR']);
const level = z.enum(['CRITICAL', 'WARNING', 'NORMAL', 'STALE']);
const condition = z.enum(['OK', 'TEMP_SUSPECT', 'DAMAGED']);
const iso = z.string().datetime({ offset: true });

export const userSchema = z
  .object({ id: z.string(), email: z.string().email(), name: z.string(), role })
  .transform((u): User => u);

export const sessionSchema = z
  .object({ token: z.string().min(10), user: userSchema, expires_at: iso })
  .transform((s): Session => ({ token: s.token, user: s.user, expiresAt: s.expires_at }));

export const shipmentSchema = z
  .object({
    id: z.string(),
    batch_no: z.string(),
    product: z.string(),
    origin_name: z.string(),
    clinic_name: z.string(),
    district: z.string(),
    driver_name: z.string().nullable(),
    vehicle_plate: z.string().nullable(),
    min_temp_c: z.number(),
    max_temp_c: z.number(),
    status: z.enum(['CREATED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'REJECTED']),
    qr_token: z.string(),
    eta_at: iso.nullable(),
    distance_left_km: z.number().nullable(),
    state: z.object({
      last_reading_at: iso.nullable(),
      last_temp_c: z.number().nullable(),
      humidity_pct: z.number().nullable(),
      out_of_range_since: iso.nullable(),
      alert_level: level,
      recent_temps: z.array(z.number()),
    }),
  })
  .transform(
    (s): Shipment => ({
      id: s.id,
      batchNo: s.batch_no,
      product: s.product,
      originName: s.origin_name,
      clinicName: s.clinic_name,
      district: s.district,
      driverName: s.driver_name,
      vehiclePlate: s.vehicle_plate,
      minTempC: s.min_temp_c,
      maxTempC: s.max_temp_c,
      status: s.status,
      qrToken: s.qr_token,
      etaAt: s.eta_at,
      distanceLeftKm: s.distance_left_km,
      state: {
        lastReadingAt: s.state.last_reading_at,
        lastTempC: s.state.last_temp_c,
        humidityPct: s.state.humidity_pct,
        outOfRangeSince: s.state.out_of_range_since,
        alertLevel: s.state.alert_level,
        recentTemps: s.state.recent_temps,
      },
    }),
  );

export const shipmentListSchema = z.object({ items: z.array(shipmentSchema), next_cursor: z.string().nullable() });

export const alertSchema = z
  .object({
    id: z.string(),
    shipment_id: z.string(),
    level: z.enum(['WARNING', 'CRITICAL']),
    episode_start: iso,
    triggered_at: iso,
    peak_temp_c: z.number(),
    message: z.string(),
    acknowledged_at: iso.nullable(),
  })
  .transform(
    (a): Alert => ({
      id: a.id,
      shipmentId: a.shipment_id,
      level: a.level,
      episodeStart: a.episode_start,
      triggeredAt: a.triggered_at,
      peakTempC: a.peak_temp_c,
      message: a.message,
      acknowledgedAt: a.acknowledged_at,
    }),
  );

export const alertListSchema = z.object({ items: z.array(alertSchema) });

export const readingSchema = z
  .object({
    reading_id: z.string(),
    shipment_id: z.string(),
    recorded_at: iso,
    temp_c: z.number(),
    humidity_pct: z.number().nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
  })
  .transform(
    (r): Reading => ({
      readingId: r.reading_id,
      shipmentId: r.shipment_id,
      recordedAt: r.recorded_at,
      tempC: r.temp_c,
      humidityPct: r.humidity_pct,
      lat: r.lat,
      lng: r.lng,
    }),
  );

export const handoffSchema = z
  .object({
    client_uuid: z.string().uuid(),
    shipment_id: z.string(),
    type: z.enum(['PICKUP', 'DELIVERY']),
    actor_label: z.string(),
    occurred_at: iso,
    synced_at: iso.nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    condition,
    hash: z.string().nullable(),
  })
  .transform(
    (h): Handoff => ({
      clientUuid: h.client_uuid,
      shipmentId: h.shipment_id,
      type: h.type,
      actorLabel: h.actor_label,
      occurredAt: h.occurred_at,
      syncedAt: h.synced_at,
      lat: h.lat,
      lng: h.lng,
      condition: h.condition,
      hash: h.hash,
    }),
  );

export const integritySchema = z
  .object({ valid: z.boolean(), records: z.number(), final_hash: z.string(), broken_at: z.string().nullable(), verified_at: iso })
  .transform(
    (r): IntegrityResult => ({ valid: r.valid, records: r.records, finalHash: r.final_hash, brokenAt: r.broken_at, verifiedAt: r.verified_at }),
  );

export const batchListSchema = z
  .object({
    items: z.array(
      z.object({
        shipment_id: z.string(),
        batch_no: z.string(),
        clinic_name: z.string(),
        delivered_at: iso,
        flag: z.object({ level: z.enum(['CRITICAL', 'WARNING']), label: z.string() }).nullable(),
      }),
    ),
  })
  .transform((r): BatchListItem[] =>
    r.items.map((i) => ({ shipmentId: i.shipment_id, batchNo: i.batch_no, clinicName: i.clinic_name, deliveredAt: i.delivered_at, flag: i.flag })),
  );

export const batchReportSchema = z
  .object({
    shipment: shipmentSchema,
    delivered_at: iso.nullable(),
    readings: z.array(readingSchema),
    events: z.array(
      z.object({
        at: iso,
        kind: z.enum(['PICKUP', 'DELIVERY', 'WARNING', 'CRITICAL', 'ACK']),
        title: z.string(),
        detail: z.string(),
        by: z.string(),
        lat: z.number().nullable(),
        lng: z.number().nullable(),
        condition: condition.nullable(),
        hash: z.string(),
      }),
    ),
    summary: z.object({
      transit_minutes: z.number(),
      reading_count: z.number(),
      min_temp_c: z.number(),
      max_temp_c: z.number(),
      out_of_range_minutes: z.number(),
      sla_breaches: z.number(),
    }),
    integrity: integritySchema,
  })
  .transform(
    (r): BatchReport => ({
      shipment: r.shipment,
      deliveredAt: r.delivered_at,
      readings: r.readings,
      events: r.events,
      summary: {
        transitMinutes: r.summary.transit_minutes,
        readingCount: r.summary.reading_count,
        minTempC: r.summary.min_temp_c,
        maxTempC: r.summary.max_temp_c,
        outOfRangeMinutes: r.summary.out_of_range_minutes,
        slaBreaches: r.summary.sla_breaches,
      },
      integrity: r.integrity,
    }),
  );

export const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

/** Client-side validation for the New shipment form (DSP-1). */
export const newShipmentFormSchema = z
  .object({
    batchNo: z.string().trim().min(3, 'Batch number is required'),
    product: z.string().trim().min(2, 'Product is required'),
    originName: z.string().trim().min(2, 'Origin is required'),
    clinicName: z.string().trim().min(2, 'Destination clinic is required'),
    minTempC: z.coerce.number().min(-30).max(30),
    maxTempC: z.coerce.number().min(-30).max(30),
  })
  .refine((v) => v.minTempC < v.maxTempC, { message: 'Min must be lower than max', path: ['maxTempC'] });
