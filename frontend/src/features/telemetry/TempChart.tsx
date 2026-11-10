import { formatTime } from '@/lib/format';

interface Point {
  recordedAt: string;
  tempC: number;
}

interface Props {
  points: Point[];
  min: number;
  max: number;
  height?: number;
  title: string;
}

const W = 900;

/**
 * Temperature over time: green target band, red shading over each out-of-range
 * run, dashed limit lines. Pure SVG so it renders offline and needs no chart library.
 */
export function TempChart({ points, min, max, height = 220, title }: Props) {
  if (points.length < 2) return null;
  const padL = 40;
  const padR = 10;
  const padT = 20;
  const padB = 40;
  const t0 = Date.parse(points[0]!.recordedAt);
  const t1 = Date.parse(points[points.length - 1]!.recordedAt);
  const temps = points.map((p) => p.tempC);
  const lo = Math.min(min - 2, ...temps);
  const hi = Math.max(max + 2, ...temps);
  const x = (iso: string) => padL + ((Date.parse(iso) - t0) / Math.max(1, t1 - t0)) * (W - padL - padR);
  const y = (t: number) => padT + (1 - (t - lo) / (hi - lo)) * (height - padT - padB);

  const breaches: { from: number; to: number }[] = [];
  let open: number | null = null;
  points.forEach((p, i) => {
    const out = p.tempC < min || p.tempC > max;
    if (out && open === null) open = i;
    if ((!out || i === points.length - 1) && open !== null) {
      breaches.push({ from: open, to: out ? i : i - 1 });
      open = null;
    }
  });

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.recordedAt).toFixed(1)} ${y(p.tempC).toFixed(1)}`).join(' ');
  const peak = points.reduce((a, b) => (Math.abs(b.tempC - (min + max) / 2) > Math.abs(a.tempC - (min + max) / 2) ? b : a));
  const ticks = 6;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={title}>
      <rect x={padL} y={y(max)} width={W - padL - padR} height={y(min) - y(max)} fill="#E5F3EC" />
      {breaches.map((b) => (
        <rect
          key={b.from}
          x={x(points[b.from]!.recordedAt) - 2}
          y={padT}
          width={Math.max(4, x(points[b.to]!.recordedAt) - x(points[b.from]!.recordedAt) + 4)}
          height={height - padT - padB}
          fill="#FDEDEB"
        />
      ))}
      <line x1={padL} x2={W - padR} y1={y(max)} y2={y(max)} stroke="#17694F" strokeDasharray="4 4" />
      <line x1={padL} x2={W - padR} y1={y(min)} y2={y(min)} stroke="#17694F" strokeDasharray="4 4" />
      <text x={padL - 8} y={y(max) + 4} fontSize={12} fill="#3D4B5C" textAnchor="end">
        {max}°
      </text>
      <text x={padL - 8} y={y(min) + 4} fontSize={12} fill="#3D4B5C" textAnchor="end">
        {min}°
      </text>
      <path d={line} fill="none" stroke="#0F1B2A" strokeWidth={2} strokeLinejoin="round" />
      {breaches.length > 0 && (
        <>
          <circle cx={x(peak.recordedAt)} cy={y(peak.tempC)} r={4} fill="#B42318" />
          <text x={x(peak.recordedAt) + 8} y={y(peak.tempC) - 6} fontSize={12} fontWeight={600} fill="#8F1D13">
            {peak.tempC.toFixed(1)} °C peak
          </text>
        </>
      )}
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const t = new Date(t0 + ((t1 - t0) * i) / ticks).toISOString();
        return (
          <text key={i} x={x(t)} y={height - 14} fontSize={12} fill="#3D4B5C" textAnchor={i === 0 ? 'start' : i === ticks ? 'end' : 'middle'}>
            {formatTime(t)}
          </text>
        );
      })}
    </svg>
  );
}
