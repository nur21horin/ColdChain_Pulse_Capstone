'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Shipment } from '@/types/domain';
import { AlertBadge } from '@/components/ui/AlertBadge';
import { TempReadout } from '@/components/ui/TempReadout';
import { Sparkline } from '@/features/telemetry/Sparkline';
import { formatDuration, formatTime } from '@/lib/format';

const ROW_H = 64;
const VIEW_H = 640;
const OVERSCAN = 6;

interface Props {
  shipments: Shipment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
}

function note(s: Shipment, now: number): string {
  const { alertLevel, outOfRangeSince, lastReadingAt, lastTempC } = s.state;
  if (s.status === 'CREATED') return 'Awaiting assignment';
  if (alertLevel === 'STALE') return lastReadingAt ? `No data · ${formatDuration(now - Date.parse(lastReadingAt))}` : 'No data yet';
  if (outOfRangeSince) {
    const side = (lastTempC ?? 0) > s.maxTempC ? 'Above max' : 'Below min';
    return `${side} · ${formatDuration(now - Date.parse(outOfRangeSince))}`;
  }
  if (alertLevel === 'WARNING') return (lastTempC ?? 0) > (s.minTempC + s.maxTempC) / 2 ? 'Near max' : 'Near min';
  return 'In range';
}

/**
 * Windowed table: only the ~20 rows in view are in the DOM, so 500+ live
 * shipments scroll smoothly (DSP-3, NFR-3).
 */
export function ShipmentTable({ shipments, selectedId, onSelect, now }: Props) {
  const [scrollTop, setScrollTop] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const last = Math.min(shipments.length, Math.ceil((scrollTop + VIEW_H) / ROW_H) + OVERSCAN);
  const visible = useMemo(() => shipments.slice(first, last), [shipments, first, last]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>, index: number, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = shipments[index + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) {
        onSelect(next.id);
        const el = bodyRef.current;
        if (el) {
          const top = (index + (e.key === 'ArrowDown' ? 1 : -1)) * ROW_H;
          if (top < el.scrollTop) el.scrollTop = top;
          if (top + ROW_H > el.scrollTop + VIEW_H) el.scrollTop = top + ROW_H - VIEW_H;
        }
      }
    }
  };

  return (
    <div className="grid-table" role="table" aria-label="Active shipments" aria-rowcount={shipments.length + 1}>
      <div className="grid-row grid-head label" role="row" aria-rowindex={1}>
        <span role="columnheader">Status</span>
        <span role="columnheader">Shipment</span>
        <span role="columnheader">Destination</span>
        <span role="columnheader">Driver · vehicle</span>
        <span role="columnheader" className="right">
          Temp
        </span>
        <span role="columnheader">Last 30 min</span>
        <span role="columnheader" className="right">
          ETA
        </span>
      </div>
      <div className="grid-body" ref={bodyRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} role="rowgroup">
        <div style={{ height: shipments.length * ROW_H }} />
        {visible.map((s, k) => {
          const index = first + k;
          return (
            <div
              key={s.id}
              className="grid-row"
              role="row"
              aria-rowindex={index + 2}
              aria-selected={s.id === selectedId}
              data-level={s.state.alertLevel}
              tabIndex={0}
              style={{ top: index * ROW_H }}
              onClick={() => onSelect(s.id)}
              onKeyDown={(e) => onKey(e, index, s.id)}
            >
              <span role="cell">
                <AlertBadge level={s.state.alertLevel} />
                <div className="cell-sub">{note(s, now)}</div>
              </span>
              <span role="cell">
                <span className="mono" style={{ fontWeight: 600 }}>
                  {s.id}
                </span>
                <div className="cell-sub">{s.product}</div>
              </span>
              <span role="cell">
                {s.clinicName}
                <div className="cell-sub">{s.district}</div>
              </span>
              <span role="cell">
                {s.driverName ?? 'Unassigned'}
                <div className="cell-sub mono">{s.vehiclePlate ?? '—'}</div>
              </span>
              <span role="cell" className="right">
                <TempReadout value={s.state.lastTempC} level={s.state.alertLevel} />
                <div className="cell-sub">
                  range {s.minTempC}–{s.maxTempC} °C
                </div>
              </span>
              <span role="cell">
                <Sparkline temps={s.state.recentTemps} min={s.minTempC} max={s.maxTempC} level={s.state.alertLevel} />
              </span>
              <span role="cell" className="right mono">
                {formatTime(s.etaAt)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
