'use client';

import type { Alert, Shipment } from '@/types/domain';
import { Icon } from '@/components/ui/Icon';
import { formatDuration, formatTemp } from '@/lib/format';

interface Props {
  alerts: Alert[];
  shipments: Shipment[];
  now: number;
  onAck: (alertId: string) => void;
  onView: (shipmentId: string) => void;
  acking: string | null;
}

/** Full-width red strip for unacknowledged Critical alerts (TEL-4). */
export function CriticalBanner({ alerts, shipments, now, onAck, onView, acking }: Props) {
  const open = alerts.filter((a) => a.level === 'CRITICAL' && !a.acknowledgedAt);
  const top = open[0];
  if (!top) return null;
  const s = shipments.find((x) => x.id === top.shipmentId);
  const temp = s?.state.lastTempC ?? top.peakTempC;
  const since = s?.state.outOfRangeSince ?? top.episodeStart;

  return (
    <div className="crit-banner" role="alert">
      <div className="container crit-banner-inner">
        <Icon name="critical" size={24} strokeWidth={2.2} />
        <div className="text">
          <strong style={{ letterSpacing: '0.04em' }}>CRITICAL</strong> · {top.shipmentId} at <strong>{formatTemp(temp)} °C</strong> for{' '}
          {formatDuration(now - Date.parse(since))} — {top.message}
          {s?.vehiclePlate ? ` · Truck ${s.vehiclePlate} → ${s.clinicName}` : ''}
        </div>
        <button type="button" className="btn btn-ack" onClick={() => onAck(top.id)} disabled={acking === top.id}>
          {acking === top.id ? 'Acknowledging…' : 'Acknowledge'}
        </button>
        <button type="button" className="btn" style={{ background: 'transparent', color: '#fff', textDecoration: 'underline' }} onClick={() => onView(top.shipmentId)}>
          View shipment
        </button>
        {open.length > 1 && <span style={{ fontSize: 13, color: '#FFD9D4' }}>+{open.length - 1} more critical</span>}
      </div>
    </div>
  );
}
