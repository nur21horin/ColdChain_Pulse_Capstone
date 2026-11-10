'use client';

import { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { RoleGuard } from '@/components/RoleGuard';
import { DataState } from '@/components/ui/DataState';
import { Button } from '@/components/ui/Button';
import { IntegrityResult } from '@/components/ui/IntegrityResult';
import { AlertBadge } from '@/components/ui/AlertBadge';
import { TempChart } from '@/features/telemetry/TempChart';
import { api } from '@/lib/api/client';
import { API_MODE } from '@/lib/api/client';
import { usePolling, useSession } from '@/lib/hooks';
import { can } from '@/lib/rbac';
import { formatDate, formatMinutes, formatTemp, formatTime, shortHash } from '@/lib/format';
import type { IntegrityResult as Integrity } from '@/types/domain';

function Reports() {
  const session = useSession();
  const batches = usePolling(() => api.listBatches());
  const [selected, setSelected] = useState<string | null>(null);
  const report = usePolling(() => (selected ? api.getBatchReport(selected) : Promise.resolve(null)), undefined, [selected]);
  const [integrity, setIntegrity] = useState<Integrity | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const role = session?.user.role;
  const r = report.data ?? null;
  const shownIntegrity = integrity ?? r?.integrity ?? null;

  function pick(id: string) {
    setSelected(id);
    setIntegrity(null);
    setError(null);
  }

  async function verify() {
    if (!selected) return;
    setVerifying(true);
    try {
      setIntegrity(await api.verifyReport(selected));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }

  async function download(format: 'csv' | 'pdf') {
    if (!selected) return;
    setDownloading(format);
    try {
      const f = await api.reportDownload(selected, format);
      const a = document.createElement('a');
      a.href = f.url;
      a.download = f.filename;
      a.click();
      setTimeout(() => f.revoke?.(), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(null);
    }
  }

  async function tamper() {
    if (!selected) return;
    await api.demoTamper(selected);
    await verify();
  }

  return (
    <>
      <AppHeader tag="Compliance" />
      <main className="container page">
        <div className="page-head">
          <div>
            <h1>Audit reports</h1>
            <p>Delivered batches with a verifiable hash chain</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,340px) minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
          <section className="card" aria-label="Delivered batches">
            {batches.status === 'loading' && <DataState kind="loading" rows={4} />}
            {batches.status === 'error' && <DataState kind="error" title="Could not load batches" onRetry={batches.reload} />}
            {batches.data?.length === 0 && <DataState kind="empty" title="No delivered batches yet" />}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {batches.data?.map((b) => (
                <li key={b.shipmentId}>
                  <button
                    type="button"
                    onClick={() => pick(b.shipmentId)}
                    aria-current={selected === b.shipmentId}
                    style={{ width: '100%', textAlign: 'left', padding: '14px 16px', border: 0, borderBottom: '1px solid var(--row-line)', background: selected === b.shipmentId ? 'var(--canvas)' : 'transparent', cursor: 'pointer' }}
                  >
                    <strong>{b.batchNo}</strong> <span className="muted">· {b.shipmentId}</span>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {b.clinicName} · {formatDate(b.deliveredAt)}
                    </div>
                    {b.flag && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <AlertBadge level={b.flag.level} />
                        <span className="muted" style={{ fontSize: 12 }}>{b.flag.label}</span>
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!selected && <DataState kind="empty" title="Select a batch" body="Pick a delivered batch to see its temperature record and custody log." />}
            {selected && report.status === 'loading' && <DataState kind="loading" rows={5} />}
            {error && <DataState kind="error" title={error} />}
            {r && (
              <>
                <div className="card card-pad" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>{r.shipment.batchNo} · {r.shipment.product}</h2>
                    <div className="muted">
                      {r.shipment.originName} → {r.shipment.clinicName} · delivered {formatDate(r.deliveredAt)} {formatTime(r.deliveredAt)}
                    </div>
                  </div>
                  {role && can.downloadReport(role) && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="secondary" icon="download" busy={downloading === 'csv'} onClick={() => download('csv')}>CSV</Button>
                      <Button variant="secondary" icon="download" busy={downloading === 'pdf'} onClick={() => download('pdf')}>PDF</Button>
                    </div>
                  )}
                </div>

                {shownIntegrity && <IntegrityResult result={shownIntegrity} onVerify={verify} verifying={verifying} />}
                {API_MODE === 'mock' && (
                  <div>
                    <Button variant="danger" onClick={tamper}>Demo: simulate an edited export</Button>
                  </div>
                )}

                <div className="tiles">
                  <div className="card card-pad"><div className="label">Transit</div><strong>{formatMinutes(r.summary.transitMinutes)}</strong></div>
                  <div className="card card-pad"><div className="label">Range seen</div><strong>{formatTemp(r.summary.minTempC)} – {formatTemp(r.summary.maxTempC)}</strong></div>
                  <div className="card card-pad"><div className="label">Out of range</div><strong>{formatMinutes(r.summary.outOfRangeMinutes)}</strong></div>
                  <div className="card card-pad"><div className="label">SLA breaches</div><strong>{r.summary.slaBreaches}</strong></div>
                </div>

                <div className="card card-pad">
                  <TempChart
                    title="Temperature record"
                    points={r.readings.map((x) => ({ recordedAt: x.recordedAt, tempC: x.tempC }))}
                    min={r.shipment.minTempC}
                    max={r.shipment.maxTempC}
                  />
                </div>

                <div className="card" style={{ overflowX: 'auto' }}>
                  <table className="log">
                    <caption className="sr-only">Custody and alert log</caption>
                    <thead>
                      <tr><th>Time</th><th>Event</th><th>By</th><th>Condition</th><th>Hash</th></tr>
                    </thead>
                    <tbody>
                      {r.events.map((e) => (
                        <tr key={e.hash}>
                          <td>{formatDate(e.at)} {formatTime(e.at)}</td>
                          <td><strong>{e.title}</strong><div className="muted">{e.detail}</div></td>
                          <td>{e.by}</td>
                          <td>{e.condition ?? '—'}</td>
                          <td className="mono">{shortHash(e.hash)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

export default function ReportsPage() {
  return (
    <RoleGuard route="/reports">
      <Reports />
    </RoleGuard>
  );
}
