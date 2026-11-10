'use client';

import { useMemo, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { RoleGuard } from '@/components/RoleGuard';
import { DataState } from '@/components/ui/DataState';
import { Button } from '@/components/ui/Button';
import { CriticalBanner } from '@/features/shipments/CriticalBanner';
import { SummaryTiles } from '@/features/shipments/SummaryTiles';
import { ShipmentTable } from '@/features/shipments/ShipmentTable';
import { ShipmentDetail } from '@/features/shipments/ShipmentDetail';
import { NewShipmentDialog } from '@/features/shipments/NewShipmentDialog';
import { api } from '@/lib/api/client';
import { usePolling, useNow, useSession } from '@/lib/hooks';
import { LEVEL_RANK } from '@/lib/alerts';
import { formatTime } from '@/lib/format';
import { can } from '@/lib/rbac';
import type { AlertLevel } from '@/types/domain';

const POLL_MS = Number(process.env.NEXT_PUBLIC_BOARD_POLL_MS ?? 5000);
type Filter = 'ALL' | AlertLevel;
const FILTERS: Filter[] = ['ALL', 'CRITICAL', 'WARNING', 'STALE', 'NORMAL'];

function Board() {
  const session = useSession();
  const now = useNow(1000);
  const ships = usePolling(() => api.listShipments(), POLL_MS);
  const alerts = usePolling(() => api.listAlerts(), POLL_MS);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [acking, setAcking] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const all = ships.data ?? [];
  const visible = useMemo(
    () =>
      all
        .filter((s) => filter === 'ALL' || s.state.alertLevel === filter)
        .sort((a, b) => LEVEL_RANK[a.state.alertLevel] - LEVEL_RANK[b.state.alertLevel]),
    [all, filter],
  );
  const selected = all.find((s) => s.id === selectedId) ?? null;
  const role = session?.user.role;

  async function ack(id: string) {
    setAcking(id);
    try {
      await api.ackAlert(id);
      await alerts.reload();
    } finally {
      setAcking(null);
    }
  }

  const live = ships.status === 'error' ? 'error' : 'ok';
  return (
    <>
      <AppHeader liveState={live} liveLabel={ships.updatedAt ? `Live · updated ${formatTime(new Date(ships.updatedAt).toISOString())}` : 'Connecting…'} />
      <CriticalBanner
        alerts={alerts.data ?? []}
        shipments={all}
        now={now}
        acking={acking}
        onAck={ack}
        onView={setSelectedId}
      />
      <main className="container page">
        <div className="page-head">
          <div>
            <h1>Live board</h1>
            <p>{all.length} shipments · most urgent first</p>
          </div>
          {role && can.createShipment(role) && (
            <Button icon="plus" onClick={() => setCreating(true)}>
              New shipment
            </Button>
          )}
        </div>

        <SummaryTiles shipments={all} />

        <div role="group" aria-label="Filter by status" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {ships.status === 'loading' && <DataState kind="loading" rows={6} />}
        {ships.status === 'error' && !ships.data && <DataState kind="error" title="Could not load shipments" body={ships.error.message} onRetry={ships.reload} />}
        {ships.data && visible.length === 0 && <DataState kind="empty" title="No shipments match this filter" />}
        {ships.data && visible.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0,1fr) 420px' : '1fr', gap: 24, alignItems: 'start' }}>
            <ShipmentTable shipments={visible} selectedId={selectedId} onSelect={setSelectedId} now={now} />
            {selected && (
              <ShipmentDetail
                shipment={selected}
                alerts={(alerts.data ?? []).filter((a) => a.shipmentId === selected.id)}
                now={now}
                canAck={!!role && can.ackAlert(role)}
                acking={acking}
                onAck={ack}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
        )}
      </main>
      <NewShipmentDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(s) => {
          setCreating(false);
          setSelectedId(s.id);
          void ships.reload();
        }}
      />
    </>
  );
}

export default function BoardPage() {
  return (
    <RoleGuard route="/board">
      <Board />
    </RoleGuard>
  );
}
