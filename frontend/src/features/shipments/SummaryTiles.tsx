import type { Shipment } from '@/types/domain';
import { Icon } from '@/components/ui/Icon';

export function SummaryTiles({ shipments }: { shipments: Shipment[] }) {
  const count = (l: string) => shipments.filter((s) => s.state.alertLevel === l).length;
  const active = shipments.filter((s) => s.status === 'IN_TRANSIT' || s.status === 'ASSIGNED').length;
  const critical = count('CRITICAL');
  const warning = count('WARNING');
  const stale = count('STALE');
  const normal = count('NORMAL');

  return (
    <section className="tiles" aria-label="Fleet summary">
      <div className="tile" data-tone={critical > 0 ? 'critical' : undefined}>
        <span className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="triangle" size={14} strokeWidth={2.6} />
          Critical
        </span>
        <span className="value">{critical}</span>
        <span className="hint">Breach over 10 min</span>
      </div>
      <div className="tile" data-tone={warning > 0 ? 'warning' : undefined}>
        <span className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="circle" size={14} strokeWidth={2.6} />
          Warning
        </span>
        <span className="value">{warning}</span>
        <span className="hint">Near limit or breach &lt; 10 min</span>
      </div>
      <div className="tile" data-tone="stale">
        <span className="label">Sensor stale</span>
        <span className="value">{stale}</span>
        <span className="hint">No reading for 90 s+</span>
      </div>
      <div className="tile">
        <span className="label">In range</span>
        <span className="value">{normal}</span>
        <span className="hint">Of {active} active</span>
      </div>
    </section>
  );
}
