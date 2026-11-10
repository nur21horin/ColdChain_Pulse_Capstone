'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import { ROLE_LABEL, canAccess } from '@/lib/rbac';
import { useSession } from '@/lib/hooks';
import { Icon } from './ui/Icon';

interface Props {
  liveLabel?: string;
  liveState?: 'ok' | 'error';
  tag?: string;
}

const LINKS = [
  { href: '/board', label: 'Live board' },
  { href: '/reports', label: 'Reports' },
] as const;

export function AppHeader({ liveLabel, liveState = 'ok', tag }: Props) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const role = session?.user.role;
  const initials = session?.user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link href="/" className="brand">
          <Icon name="logo" size={28} style={{ color: '#7FD3F5' }} />
          ColdChain Pulse
          {tag && <span className="brand-tag">{tag}</span>}
        </Link>
        <nav className="nav" aria-label="Main">
          {role &&
            LINKS.filter((l) => canAccess(l.href, role)).map((l) => (
              <Link key={l.href} href={l.href} aria-current={pathname.startsWith(l.href) ? 'page' : undefined}>
                {l.label}
              </Link>
            ))}
        </nav>
        <div className="row" style={{ gap: 16 }}>
          {liveLabel && (
            <span className="live-dot" data-state={liveState}>
              {liveLabel}
            </span>
          )}
          {session && (
            <button
              type="button"
              className="user-chip"
              title="Sign out"
              onClick={() => {
                api.logout();
                router.replace('/login');
              }}
            >
              <span className="avatar">{initials}</span>
              {ROLE_LABEL[session.user.role]}
              {session.user.role === 'AUDITOR' ? ' · read-only' : ''}
              <span className="sr-only">, sign out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
