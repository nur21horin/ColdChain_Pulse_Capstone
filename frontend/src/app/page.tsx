'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/hooks';
import { homeFor } from '@/lib/rbac';

export default function Home() {
  const session = useSession();
  const router = useRouter();
  useEffect(() => {
    if (session === undefined) return;
    router.replace(session ? homeFor(session.user.role) : '/login');
  }, [session, router]);
  return null;
}
