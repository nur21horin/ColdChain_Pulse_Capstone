import type { IntegrityResult as Integrity } from '@/types/domain';
import { formatDate, formatTime, shortHash } from '@/lib/format';
import { Icon } from './Icon';

interface Props {
  result: Integrity;
  onVerify?: () => void;
  verifying?: boolean;
}

export function IntegrityResult({ result, onVerify, verifying }: Props) {
  return (
    <div className="card card-pad integrity" data-valid={result.valid} role={result.valid ? undefined : 'alert'}>
      <span className="seal">
        {result.valid ? (
          <Icon name="shield" size={22} strokeWidth={2.4} style={{ color: 'var(--normal)' }} />
        ) : (
          <Icon name="close" size={22} strokeWidth={2.6} style={{ color: '#fff' }} />
        )}
      </span>
      <div style={{ flex: '1 1 320px' }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: result.valid ? 'var(--normal)' : 'var(--critical-dark)' }}>
          {result.valid ? 'Hash chain intact — no record has been altered' : 'Tampering detected'}
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {result.valid ? (
            <>
              Verified {formatDate(result.verifiedAt)}, {formatTime(result.verifiedAt)} · {result.records} records · final hash{' '}
              <span className="mono" style={{ color: 'var(--ink)' }}>
                {shortHash(result.finalHash)}
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--critical-dark)' }}>Chain breaks at {result.brokenAt ?? 'an unknown row'}</span>
          )}
        </div>
      </div>
      {onVerify && (
        <button type="button" className="btn btn-secondary" onClick={onVerify} disabled={verifying}>
          {verifying ? 'Verifying…' : 'Verify again'}
        </button>
      )}
    </div>
  );
}
