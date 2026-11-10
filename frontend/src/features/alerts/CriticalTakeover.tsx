'use client';

import type { Shipment } from '@/types/domain';
import { Icon } from '@/components/ui/Icon';
import { formatTemp } from '@/lib/format';

interface Props {
  shipment: Shipment;
  breachMinutes: number;
  onHandle: () => void;
  dispatchPhone?: string;
}

/** Full-screen Critical alert on the driver's phone (design/Driver-Critical.dc.html). */
export function CriticalTakeover({ shipment: s, breachMinutes, onHandle, dispatchPhone }: Props) {
  const above = (s.state.lastTempC ?? 0) > s.maxTempC;
  const limit = above ? s.maxTempC : s.minTempC;
  return (
    <div className="takeover" role="alertdialog" aria-modal="true" aria-labelledby="crit-title" aria-describedby="crit-desc">
      <div className="takeover-inner">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
          <span style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--critical-dark)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="critical" size={48} strokeWidth={2.2} />
          </span>
          <h1 id="crit-title" style={{ margin: '8px 0 0', fontSize: 22, letterSpacing: '0.12em' }}>
            CRITICAL
          </h1>
          <div className="temp" style={{ fontSize: 72 }}>
            {formatTemp(s.state.lastTempC)}
            <small> °C</small>
          </div>
          <div id="crit-desc" style={{ fontSize: 18, fontWeight: 600 }}>
            {above ? 'Above' : 'Below'} {limit} °C for {breachMinutes} minutes
          </div>
          <div style={{ fontSize: 14, color: '#FFD9D4' }}>
            {s.id} · {s.product} · Dispatch has been alerted
          </div>
        </div>

        <section aria-label="What to do now" style={{ background: '#fff', color: 'var(--ink)', borderRadius: 16, padding: '18px 18px 8px' }}>
          <h2 className="label" style={{ margin: '0 0 8px' }}>
            Do now
          </h2>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 16 }}>
            {['Check the reefer unit is running and set to 5 °C', 'Keep the cargo doors closed', 'Call dispatch before you drive on'].map((t, i) => (
              <li key={t} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--row-line)' : 0 }}>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--critical)' }}>
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
        </section>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {dispatchPhone && (
            <a href={`tel:${dispatchPhone}`} className="btn btn-driver" style={{ background: '#fff', color: 'var(--critical-dark)' }}>
              <Icon name="phone" size={24} strokeWidth={2.4} />
              Call dispatch
            </a>
          )}
          <button type="button" className="btn btn-driver" style={{ background: 'transparent', color: '#fff', border: '3px solid #fff' }} onClick={onHandle}>
            I&apos;m handling it
          </button>
          <p style={{ margin: 0, textAlign: 'center', fontSize: 13, color: '#FFD9D4' }}>This alert stays on record. Acknowledging does not clear it.</p>
        </div>
      </div>
    </div>
  );
}
