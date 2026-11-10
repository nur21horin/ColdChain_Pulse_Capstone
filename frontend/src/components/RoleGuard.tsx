'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { canAccess, homeFor, type GuardedRoute } from '@/lib/rbac';
import { useSession } from '@/lib/hooks';
import { DataState } from './ui/DataState';

/**
 * Client-side route guard. It only improves UX: every API call is still
 * authorised by the server (PRD §3), so a bypassed guard shows nothing useful.
 */
export function RoleGuard({ route, children }: { route: GuardedRoute; children: ReactNode }) {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session === undefined) return;
    if (!session) router.replace(`/login?next=${encodeURIComponent(route)}`);
    else if (!canAccess(route, session.user.role)) router.replace(homeFor(session.user.role));
  }, [session, route, router]);

  if (!session || !canAccess(route, session.user.role)) {
    return (
      <div className="container" style={{ paddingTop: 48 }}>
        <DataState kind="loading" rows={3} />
      </div>
    );
  }
  return <>{children}</>;
}
