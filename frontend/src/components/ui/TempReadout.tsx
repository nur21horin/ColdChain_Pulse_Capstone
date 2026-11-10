import type { AlertLevel } from '@/types/domain';
import { formatTemp } from '@/lib/format';

const SIZES = { sm: 16, lg: 44, xl: 72 } as const;

interface Props {
  value: number | null;
  level: AlertLevel;
  size?: keyof typeof SIZES;
  panel?: boolean;
}

export function TempReadout({ value, level, size = 'sm', panel = false }: Props) {
  const text = (
    <span className="temp" data-level={level} style={{ fontSize: SIZES[size] }}>
      {formatTemp(value)}
      <small> °C</small>
    </span>
  );
  return panel ? (
    <div className="temp-panel" data-level={level}>
      {text}
    </div>
  ) : (
    text
  );
}
