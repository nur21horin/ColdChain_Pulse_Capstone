import type { ReactNode } from 'react';

type Props =
  | { kind: 'loading'; rows?: number }
  | { kind: 'empty'; title: string; body?: string; action?: ReactNode }
  | { kind: 'error'; title: string; body?: string; onRetry?: () => void }
  | { kind: 'offline'; title: string; body?: string };

/** Wraps every list, table and chart so loading/empty/error/offline look the same everywhere. */
export function DataState(props: Props) {
  if (props.kind === 'loading') {
    const widths = ['80%', '60%', '70%', '45%', '65%', '55%'];
    return (
      <div className="state-box" aria-busy="true" aria-label="Loading">
        {widths.slice(0, props.rows ?? 4).map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w }} />
        ))}
      </div>
    );
  }
  return (
    <div className="state-box" data-kind={props.kind} role={props.kind === 'error' ? 'alert' : undefined}>
      <div className="label" style={{ color: 'inherit' }}>
        {props.kind}
      </div>
      <strong style={{ fontSize: 15 }}>{props.title}</strong>
      {props.body && <span>{props.body}</span>}
      {props.kind === 'empty' && props.action}
      {props.kind === 'error' && props.onRetry && (
        <button type="button" className="btn btn-secondary" onClick={props.onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
