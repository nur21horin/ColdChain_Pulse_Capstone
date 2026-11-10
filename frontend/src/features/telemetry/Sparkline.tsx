import type { AlertLevel } from '@/types/domain';

const COLOR: Record<AlertLevel, string> = { CRITICAL: '#B42318', WARNING: '#B07A00', NORMAL: '#17694F', STALE: '#8995A3' };

interface Props {
  temps: number[];
  min: number;
  max: number;
  level: AlertLevel;
  width?: number;
  height?: number;
}

/** 30-minute trend with dashed min/max guides. Scale: min−2 °C … max+2 °C. */
export function Sparkline({ temps, min, max, level, width = 96, height = 28 }: Props) {
  const lo = min - 2;
  const hi = max + 2;
  const y = (t: number) => height - ((Math.min(hi, Math.max(lo, t)) - lo) / (hi - lo)) * height;
  const step = temps.length > 1 ? width / (temps.length - 1) : 0;
  const d = temps.map((t, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)} ${y(t).toFixed(1)}`).join(' ');
  const first = temps[0];
  const last = temps[temps.length - 1];
  const label =
    first === undefined || last === undefined ? 'No readings yet' : `Last 30 minutes: from ${first.toFixed(1)} to ${last.toFixed(1)} °C`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <line x1={0} x2={width} y1={y(max)} y2={y(max)} stroke="#C9D2DC" strokeDasharray="2 3" />
      <line x1={0} x2={width} y1={y(min)} y2={y(min)} stroke="#C9D2DC" strokeDasharray="2 3" />
      {d && <path d={d} fill="none" stroke={COLOR[level]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
