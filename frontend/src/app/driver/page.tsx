'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { AppHeader } from '@/components/AppHeader';
import { DataState } from '@/components/ui/DataState';
import { ConnectionBanner } from '@/components/ui/ConnectionBanner';
import { AlertBadge } from '@/components/ui/AlertBadge';
import { TempReadout } from '@/components/ui/TempReadout';
import { CriticalTakeover } from '@/features/alerts/CriticalTakeover';
import { api, readingOutboxPayload } from '@/lib/api/client';
import { usePolling, useNow } from '@/lib/hooks';
import { useOutbox } from '@/lib/offline/useOutbox';
import { uuid } from '@/lib/uuid';
import { formatTime } from '@/lib/format';

function Driver() {
  const now = useNow(1000);
  const outbox = useOutbox();
  const mine = usePolling(() => api.listShipments({ scope: 'mine' }), 10_000);
  const [handled, setHandled] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [saved, setSaved] = useState(false);

  const s = mine.data?.[0] ?? null;
  const breachMin = s?.state.outOfRangeSince ? Math.max(0, Math.floor((now - Date.parse(s.state.outOfRangeSince)) / 60_000)) : 0;
  const critical = s?.state.alertLevel === 'CRITICAL' && handled !== s.id;

  async function saveReading(e: React.FormEvent) {
    e.preventDefault();
    const tempC = Number(manual);
    if (!s || manual.trim() === '' || Number.isNaN(tempC)) return;
    const recordedAt = new Date().toISOString();
    const payload = readingOutboxPayload({ readingId: uuid(), shipmentId: s.id, tempC, recordedAt });
    await outbox.enqueue({ clientUuid: uuid(), ...payload, occurredAt: recordedAt, label: `Reading ${tempC.toFixed(1)} °C` });
    setManual('');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="driver-shell">
      <AppHeader tag="Driver" />
      <ConnectionBanner status={outbox.status} pending={outbox.pending.length} needsAttention={outbox.needsAttention.length} />
      <main className="driver-main">
        {mine.status === 'loading' && <DataState kind="loading" rows={4} />}
        {mine.status === 'error' && !mine.data && <DataState kind="error" title="Could not load your shipment" body="Your saved handoffs are safe on this phone." onRetry={mine.reload} />}
        {mine.data && !s && <DataState kind="empty" title="No shipment assigned" body="Ask dispatch to assign you a shipment." />}
        {s && (
          <>
            <div className="driver-card">
              <div className="section">
                <div className="label">{s.id} · {s.batchNo}</div>
                <h1 style={{ margin: '4px 0', fontSize: 22 }}>{s.product}</h1>
                <div className="muted">To {s.clinicName}</div>
              </div>
              <div className="section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <TempReadout value={s.state.lastTempC} level={s.state.alertLevel} size="lg" />
                <div style={{ textAlign: 'right' }}>
                  <AlertBadge level={s.state.alertLevel} />
                  <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Range {s.minTempC}–{s.maxTempC} °C</div>
                  <div className="muted" style={{ fontSize: 13 }}>Last reading {formatTime(s.state.lastReadingAt)}</div>
                </div>
              </div>
            </div>

            <Link href={`/driver/handoff?shipment=${encodeURIComponent(s.id)}`} className="btn btn-primary" style={{ minHeight: 72, fontSize: 20, justifyContent: 'center' }}>
              {s.status === 'IN_TRANSIT' ? 'Confirm delivery' : 'Confirm pickup'}
            </Link>

            <form className="driver-card" onSubmit={saveReading}>
              <div className="section">
                <label htmlFor="manual" style={{ fontWeight: 700 }}>Enter a reading by hand</label>
                <div className="muted" style={{ fontSize: 13 }}>Use this if the sensor stops reporting.</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input id="manual" inputMode="decimal" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="e.g. 5.2" style={{ flex: 1, minHeight: 56, fontSize: 18 }} />
                  <button type="submit" className="btn btn-secondary" style={{ minHeight: 56 }}>Save</button>
                </div>
                {saved && <div role="status" style={{ marginTop: 8, color: 'var(--normal)', fontWeight: 600 }}>Saved{outbox.online ? '' : ' on this phone — will sync later'}</div>}
              </div>
            </form>

            {outbox.pending.length + outbox.needsAttention.length > 0 && (
              <section className="driver-card" aria-label="Waiting to sync">
                <div className="section"><strong>Waiting to sync</strong></div>
                {[...outbox.pending, ...outbox.needsAttention].map((i) => (
                  <div key={i.clientUuid} className="section" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div>{i.label}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{i.status === 'needs_attention' ? i.lastError ?? 'Rejected by server' : `Saved ${formatTime(i.occurredAt)}`}</div>
                    </div>
                    {i.status === 'needs_attention' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="btn btn-secondary" onClick={() => outbox.retry(i.clientUuid)}>Retry</button>
                        <button type="button" className="btn btn-secondary" onClick={() => outbox.discard(i.clientUuid)}>Discard</button>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>
      {s && critical && (
        <CriticalTakeover shipment={s} breachMinutes={breachMin} onHandle={() => setHandled(s.id)} dispatchPhone={process.env.NEXT_PUBLIC_DISPATCH_PHONE} />
      )}
    </div>
  );
}

export default function DriverPage() {
  return (
    <RoleGuard route="/driver">
      <Driver />
    </RoleGuard>
  );
}
