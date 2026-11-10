// Typed API client. One function per endpoint in PRD §9.
// NEXT_PUBLIC_API_MODE=mock serves generated demo data so the frontend squad is
// never blocked on the backend; "live" calls the real REST API.

import type { z } from 'zod';
import type {
  Alert,
  BatchListItem,
  BatchReport,
  IntegrityResult,
  ManualReadingInput,
  NewShipmentInput,
  HandoffInput,
  Session,
  Shipment,
} from '@/types/domain';
import { getSession, setSession } from '@/lib/session';
import type { OutboxItem, SendResult } from '@/lib/offline/outbox';
import {
  alertListSchema,
  alertSchema,
  batchListSchema,
  batchReportSchema,
  errorSchema,
  integritySchema,
  sessionSchema,
  shipmentListSchema,
  shipmentSchema,
} from './schemas';
import { ApiError } from './errors';

export { ApiError };

// Mock data is code-split: it is only downloaded when API mode is "mock" (NFR-13).
const loadMock = () => import('./mock');

export const API_MODE: 'mock' | 'live' = process.env.NEXT_PUBLIC_API_MODE === 'live' ? 'live' : 'mock';
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1';

async function request<S extends z.ZodTypeAny>(path: string, schema: S, init: RequestInit = {}): Promise<z.output<S>> {
  const session = getSession();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (session) headers.set('Authorization', `Bearer ${session.token}`);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network unavailable');
  }

  const json: unknown = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401) setSession(null);
    const parsed = errorSchema.safeParse(json);
    const err = parsed.success ? parsed.data.error : { code: `HTTP_${res.status}`, message: res.statusText };
    throw new ApiError(res.status, err.code, err.message, (json as { error?: { details?: Record<string, unknown> } })?.error?.details);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    console.error(`[api] ${path} response did not match the contract`, parsed.error.flatten());
    throw new ApiError(res.status, 'CONTRACT_MISMATCH', 'The server sent data in an unexpected format');
  }
  return parsed.data;
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const api = {
  async login(email: string, password: string): Promise<Session> {
    const session = API_MODE === 'mock' ? await (await loadMock()).login(email, password) : await request('/auth/login', sessionSchema, post({ email, password }));
    setSession(session);
    return session;
  },

  logout(): void {
    setSession(null);
  },

  async listShipments(params: { scope?: 'all' | 'mine' } = {}): Promise<Shipment[]> {
    if (API_MODE === 'mock') return (await loadMock()).listShipments(params.scope ?? 'all', getSession());
    const out: Shipment[] = [];
    let cursor: string | null = null;
    do {
      const qs = new URLSearchParams({ limit: '100', status: 'IN_TRANSIT,ASSIGNED' });
      if (cursor) qs.set('cursor', cursor);
      const page = await request(`/shipments?${qs}`, shipmentListSchema);
      out.push(...page.items);
      cursor = page.next_cursor;
    } while (cursor);
    return out;
  },

  async getShipment(id: string): Promise<Shipment> {
    if (API_MODE === 'mock') return (await loadMock()).getShipment(id);
    return request(`/shipments/${encodeURIComponent(id)}`, shipmentSchema);
  },

  async createShipment(input: NewShipmentInput): Promise<Shipment> {
    if (API_MODE === 'mock') return (await loadMock()).createShipment(input);
    return request(
      '/shipments',
      shipmentSchema,
      post({
        batch_no: input.batchNo,
        product: input.product,
        origin_name: input.originName,
        clinic_name: input.clinicName,
        min_temp_c: input.minTempC,
        max_temp_c: input.maxTempC,
      }),
    );
  },

  async listAlerts(params: { level?: 'CRITICAL' | 'WARNING'; shipmentId?: string } = {}): Promise<Alert[]> {
    if (API_MODE === 'mock') return (await loadMock()).listAlerts(params);
    const qs = new URLSearchParams();
    if (params.level) qs.set('level', params.level);
    if (params.shipmentId) qs.set('shipment_id', params.shipmentId);
    return (await request(`/alerts?${qs}`, alertListSchema)).items;
  },

  async ackAlert(id: string, note?: string): Promise<Alert> {
    if (API_MODE === 'mock') return (await loadMock()).ackAlert(id);
    return request(`/alerts/${encodeURIComponent(id)}/ack`, alertSchema, post({ note: note ?? null }));
  },

  async listBatches(): Promise<BatchListItem[]> {
    if (API_MODE === 'mock') return (await loadMock()).listBatches();
    return request('/reports/batches?breaches_only=true', batchListSchema);
  },

  async getBatchReport(shipmentId: string): Promise<BatchReport> {
    if (API_MODE === 'mock') return (await loadMock()).getBatchReport(shipmentId);
    return request(`/reports/batches/${encodeURIComponent(shipmentId)}`, batchReportSchema);
  },

  async verifyReport(shipmentId: string): Promise<IntegrityResult> {
    if (API_MODE === 'mock') return (await loadMock()).verifyReport(shipmentId);
    return request(`/reports/${encodeURIComponent(shipmentId)}/verify`, integritySchema);
  },

  /** Live: a server URL. Mock: a CSV built in the browser from the report. */
  async reportDownload(shipmentId: string, format: 'csv' | 'pdf'): Promise<{ url: string; filename: string; revoke?: () => void }> {
    if (API_MODE === 'mock') return (await loadMock()).reportDownload(shipmentId, format);
    // The download needs the bearer token, so fetch it and hand the browser a blob URL.
    const session = getSession();
    const res = await fetch(`${BASE}/reports/${encodeURIComponent(shipmentId)}/download?format=${format}`, {
      headers: session ? { Authorization: `Bearer ${session.token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, `HTTP_${res.status}`, 'Could not download the report');
    const url = URL.createObjectURL(await res.blob());
    return { url, filename: `${shipmentId}-report.${format}`, revoke: () => URL.revokeObjectURL(url) };
  },

  /** Mock mode only: simulate an edited export so the verify step fails (demo step 7). */
  async demoTamper(shipmentId: string): Promise<void> {
    if (API_MODE === 'mock') (await loadMock()).tamper(shipmentId);
  },
};

// ---- Outbox payloads (driver writes that may be queued offline) ----

export function handoffOutboxPayload(h: HandoffInput) {
  return {
    endpoint: '/handoffs',
    body: {
      client_uuid: h.clientUuid,
      shipment_id: h.shipmentId,
      type: h.type,
      qr_token: h.qrToken,
      pin: h.pin,
      condition: h.condition,
      lat: h.lat,
      lng: h.lng,
      occurred_at: h.occurredAt,
    },
  };
}

export function readingOutboxPayload(r: ManualReadingInput) {
  return {
    endpoint: '/telemetry',
    body: { readings: [{ reading_id: r.readingId, shipment_id: r.shipmentId, temp_c: r.tempC, recorded_at: r.recordedAt, source: 'DRIVER_MANUAL' }] },
  };
}

/** Sends one queued item. Never throws for HTTP errors; the outbox decides what to do. */
export async function sendOutboxItem(item: OutboxItem): Promise<SendResult> {
  if (API_MODE === 'mock') return (await loadMock()).acceptOutboxItem(item);
  const session = getSession();
  const res = await fetch(`${BASE}${item.endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': item.clientUuid,
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: JSON.stringify(item.body),
  });
  let message: string | undefined;
  if (!res.ok) {
    const parsed = errorSchema.safeParse(await res.json().catch(() => null));
    message = parsed.success ? parsed.data.error.message : res.statusText;
  }
  return { ok: res.ok, status: res.status, message };
}
