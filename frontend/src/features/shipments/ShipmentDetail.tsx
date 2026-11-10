'use client';

import type { Alert, Shipment } from '@/types/domain';
import { AlertBadge } from '@/components/ui/AlertBadge';
import { Icon } from '@/components/ui/Icon';
import { TempReadout } from '@/components/ui/TempReadout';
import { TempChart } from '@/features/telemetry/TempChart';
import { formatDuration, formatTime, secondsAgo } from '@/lib/format';

interface Props {
  shipment: Shipment;
  alerts: Alert[];
  now: number;
  canAck: boolean;
  acking: string | null;
  onAck: (alertId: string) => void;
  onClose: () => void;
}

export function ShipmentDetail({ shipment: s, alerts, now, canAck, acking, onAck, onClose }: Props) {
  const level = s.state.alertLevel;
  const lastAt = s.state.lastReadingAt ? Date.parse(s.state.lastReadingAt) : now;
  const points = s.state.recentTemps.map((tempC, i, arr) => ({
    recordedAt: new Date(lastAt - (arr.length - 1 - i) * 30_000).toISOString(),
    tempC,
  }));
  const openCritical = alerts.find((a) => a.level === 'CRITICAL' && !a.acknowledgedAt);
  const t = s.state.lastTempC;
  const delta = t === null ? null : t > s.maxTempC ? t - s.maxTempC : t < s.minTempC ? s.minTempC - t : null;

  return (
    <aside className="card detail" data-level={level} aria-label={`Shipment ${s.id}`}>
      <div className="detail-section row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="mono" style={{ fontWeight: 600, fontSize: 18 }}>
            {s.id}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Batch {s.batchNo} · {s.originName} → {s.clinicName}
          </div>
        </div>
        <button type="button" className="btn btn-secondary" style={{ minHeight: 36, padding: '0 10px' }} onClick={onClose} aria-label="Close detail">
          <Icon name="close" />
        </button>
      </div>

      <div className="detail-section row" style={{ gap: 16, background: level === 'CRITICAL' ? 'var(--critical-tint)' : undefined }}>
        <TempReadout value={t} level={level} size="lg" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <AlertBadge level={level} />
          {s.state.outOfRangeSince && (
            <span style={{ color: 'var(--critical-dark)', fontWeight: 600 }}>Out of range for {formatDuration(now - Date.parse(s.state.outOfRangeSince))}</span>
          )}
          <span className="muted">
            {delta !== null ? `${delta.toFixed(1)} °C ${t! > s.maxTempC ? 'above max' : 'below min'} · ` : `Target ${s.minTempC}–${s.maxTempC} °C · `}
            humidity {s.state.humidityPct ?? '—'}%
          </span>
          <span className="muted">Last reading {secondsAgo(s.state.lastReadingAt, now)}</span>
        </div>
      </div>

      <div className="detail-section">
        <div className="label" style={{ marginBottom: 8 }}>
          Temperature · last 30 min
        </div>
        {points.length > 1 ? (
          <TempChart points={points} min={s.minTempC} max={s.maxTempC} height={260} title={`Temperature for ${s.id} over the last 30 minutes`} />
        ) : (
          <p className="muted">No readings yet.</p>
        )}
      </div>

      <div className="detail-section">
        <div className="label" style={{ marginBottom: 10 }}>
          Alerts
        </div>
        {alerts.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No alerts on this shipment.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            {alerts.map((a) => (
              <div key={a.id} className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                <span>
                  <strong style={{ color: a.level === 'CRITICAL' ? 'var(--critical-dark)' : 'var(--warning-text)' }}>{a.level === 'CRITICAL' ? 'Critical' : 'Warning'}</strong> ·{' '}
                  {a.message}
                  {a.acknowledgedAt ? ` · acked ${formatTime(a.acknowledgedAt)}` : ''}
                </span>
                <span className="mono muted">{formatTime(a.triggeredAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="detail-section">
        <div className="label" style={{ marginBottom: 12 }}>
          Chain of custody
        </div>
        <ol className="timeline">
          <li>
            <span className="dot" data-state={s.status === 'IN_TRANSIT' || s.status === 'DELIVERED' ? 'done' : 'next'}>
              {(s.status === 'IN_TRANSIT' || s.status === 'DELIVERED') && <Icon name="check" size={12} strokeWidth={3} style={{ color: '#fff' }} />}
            </span>
            <span>
              <strong>Pickup</strong> · {s.originName}
              <br />
              <span className="muted">{s.status === 'CREATED' || s.status === 'ASSIGNED' ? 'Awaiting driver sign-off' : 'QR + PIN verified'}</span>
            </span>
          </li>
          <li>
            <span className="dot" data-state={s.status === 'IN_TRANSIT' ? 'current' : s.status === 'DELIVERED' ? 'done' : 'next'} />
            <span>
              <strong>In transit</strong>
              {s.distanceLeftKm !== null ? ` · ${s.distanceLeftKm} km to go` : ''}
              <br />
              <span className="muted">ETA {formatTime(s.etaAt)}</span>
            </span>
          </li>
          <li>
            <span className="dot" data-state={s.status === 'DELIVERED' ? 'done' : 'next'} />
            <span className="muted">
              <strong style={{ color: 'var(--ink)' }}>Delivery</strong> · {s.clinicName}
              {openCritical || level === 'CRITICAL' ? <><br />Will default to TEMP_SUSPECT</> : null}
            </span>
          </li>
        </ol>
      </div>

      {canAck && openCritical && (
        <div className="detail-section row">
          <button type="button" className="btn btn-danger" style={{ flex: '1 1 160px' }} onClick={() => onAck(openCritical.id)} disabled={acking === openCritical.id}>
            {acking === openCritical.id ? 'Acknowledging…' : 'Acknowledge alert'}
          </button>
        </div>
      )}
    </aside>
  );
}
