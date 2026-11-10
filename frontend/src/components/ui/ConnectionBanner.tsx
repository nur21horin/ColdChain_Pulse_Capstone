import type { ConnectionStatus } from '@/lib/offline/useOutbox';
import { Icon } from './Icon';

interface Props {
  status: ConnectionStatus;
  pending: number;
  needsAttention: number;
  compact?: boolean;
}

/** Driver's always-visible connection + sync state (OFF-4). */
export function ConnectionBanner({ status, pending, needsAttention, compact = false }: Props) {
  if (needsAttention > 0) {
    return (
      <div className="conn" data-status="attention" role="alert">
        <Icon name="warning" size={20} strokeWidth={2.4} />
        <span>
          <strong>Needs attention</strong> · {needsAttention} {needsAttention === 1 ? 'item was' : 'items were'} rejected
        </span>
      </div>
    );
  }
  if (status === 'offline') {
    return (
      <div className="conn" data-status="offline" role="status">
        <Icon name="offline" size={compact ? 16 : 24} strokeWidth={2.2} style={{ color: '#FFD166' }} />
        <div>
          <strong>Offline</strong>
          <div className="sub">{pending > 0 ? `${pending} ${pending === 1 ? 'item' : 'items'} saved on phone · will sync automatically` : 'New entries are saved on this phone'}</div>
        </div>
      </div>
    );
  }
  if (status === 'syncing') {
    return (
      <div className="conn" data-status="syncing" role="status">
        <Icon name="sync" size={20} strokeWidth={2.4} />
        <span>
          <strong>Syncing</strong> · {pending} left
        </span>
      </div>
    );
  }
  return (
    <div className="conn" data-status="online" role="status">
      <Icon name="check" size={20} strokeWidth={2.6} />
      <span>
        <strong>Online</strong> · {pending > 0 ? `${pending} waiting to sync` : 'all handoffs synced'}
      </span>
    </div>
  );
}
