'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError, API_MODE } from '@/lib/api/client';
import { DEMO_ACCOUNTS } from '@/lib/api/demoAccounts';
import { canAccess, homeFor, ROUTE_ROLES, type GuardedRoute } from '@/lib/rbac';
import { Icon } from '@/components/ui/Icon';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await api.login(email, password);
      const next = params.get('next');
      const target = next && next in ROUTE_ROLES && canAccess(next as GuardedRoute, session.user.role) ? next : homeFor(session.user.role);
      router.replace(target);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
        const left = Number(err.details?.attempts_left ?? NaN);
        setError({ message: 'Email or password is wrong.', hint: Number.isFinite(left) ? `${left} ${left === 1 ? 'try' : 'tries'} left before a 15-minute lock.` : undefined });
      } else if (err instanceof ApiError && err.code === 'LOCKED') {
        setError({ message: 'Too many failed attempts.', hint: 'This account is locked for 15 minutes.' });
      } else {
        setError({ message: err instanceof Error ? err.message : 'Sign-in failed.' });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit} noValidate>
      <div>
        <h2 style={{ margin: 0, fontSize: 24 }}>Sign in</h2>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Your role decides what you&apos;ll see next.
        </p>
      </div>

      {error && (
        <div className="notice" data-tone="error" role="alert">
          <Icon name="warning" size={18} strokeWidth={2.4} style={{ flex: 'none', marginTop: 1 }} />
          <span>
            {error.message} {error.hint && <strong>{error.hint}</strong>}
          </span>
        </div>
      )}

      <label className="field">
        Work email
        <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        Password
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          aria-invalid={error ? true : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <button type="submit" className="btn btn-primary" style={{ minHeight: 52, fontSize: 16 }} disabled={busy || !email || !password}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Failed attempts are logged with time and IP address. Forgot your password? Ask your MedSwift admin.
      </p>

      {API_MODE === 'mock' && (
        <details style={{ fontSize: 13 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Demo accounts (mock mode only)</summary>
          <p className="muted">
            Password for all: <span className="mono">demo1234</span>
          </p>
          <ul style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  style={{ background: 'none', border: 0, padding: 0, color: 'var(--brand)', textDecoration: 'underline' }}
                  onClick={() => {
                    setEmail(a.email);
                    setPassword('demo1234');
                  }}
                >
                  {a.email}
                </button>{' '}
                — {a.note}
              </li>
            ))}
          </ul>
        </details>
      )}
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="login">
      <section className="login-hero">
        <div className="brand" style={{ fontSize: 22 }}>
          <Icon name="logo" size={36} style={{ color: '#7FD3F5' }} />
          ColdChain Pulse
        </div>
        <div>
          <h1>
            Every degree,
            <br />
            every handoff,
            <br />
            on record.
          </h1>
          <p style={{ margin: '20px 0 0', fontSize: 17, color: 'var(--on-dark)', maxWidth: 400 }}>
            Live cold-chain monitoring for MedSwift Logistics — from central warehouse to rural clinic.
          </p>
        </div>
        <div className="row" style={{ gap: 28, fontSize: 14, color: 'var(--on-dark)' }}>
          <span className="live-dot">Encrypted connection</span>
          <span>Append-only records</span>
        </div>
      </section>
      <main className="login-form-wrap">
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
