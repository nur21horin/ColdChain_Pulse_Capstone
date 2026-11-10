import type { AlertLevel } from '@/types/domain';
import { Icon, type IconName } from './Icon';

const ICON: Record<AlertLevel, IconName> = { CRITICAL: 'triangle', WARNING: 'circle', NORMAL: 'check', STALE: 'stale' };
const LABEL: Record<AlertLevel, string> = { CRITICAL: 'Critical', WARNING: 'Warning', NORMAL: 'Normal', STALE: 'Stale' };

/** Severity is always icon + word + colour, never colour alone (NFR-11). */
export function AlertBadge({ level }: { level: AlertLevel }) {
  return (
    <span className="badge" data-level={level}>
      <Icon name={ICON[level]} size={12} strokeWidth={3} />
      {LABEL[level].toUpperCase()}
    </span>
  );
}
