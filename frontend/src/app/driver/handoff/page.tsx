'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { ConnectionBanner } from '@/components/ui/ConnectionBanner';
import { DataState } from '@/components/ui/DataState';
import { Icon } from '@/components/ui/Icon';
import { PinPad } from '@/features/handoff/PinPad';
import { QrScanner } from '@/features/handoff/QrScanner';
import { ConditionPicker } from '@/features/handoff/ConditionPicker';
import { api, handoffOutboxPayload } from '@/lib/api/client';
import { usePolling } from '@/lib/hooks';
import { useOutbox } from '@/lib/offline/useOutbox';
import { uuid } from '@/lib/uuid';
import type { Condition, HandoffType } from '@/types/domain';

type Step = 'scan' | 'pin' | 'condition' | 'done';

function Flow() {
  const router = useRouter();
  const shipmentId = useSearchParams().get('shipment') ?? '';
  const outbox = useOutbox();
  const ship = usePolling(() => (shipmentId ? api.getShipment(shipmentId) : Promise.reject(new Error('No shipment selected'))), undefined, [shipmentId]);
  const [step, setStep] = useState<Step>('scan');
  const [qr, setQr] = useState('');
  const [pin, setPin] = useState('');
  const [condition, setCondition] = useState<Condition>('OK');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One id per handoff attempt, so a retry or double-tap is deduplicated by the server.
  const [clientUuid] = useState(() => uuid());

  const s = ship.data;
  const type: HandoffType = s?.status === 'IN_TRANSIT' ? 'DELIVERY' : 'PICKUP';

  function onScan(code: string) {
    if (s && code !== s.qrToken) {
      setError('This QR code is for a different shipment. Check the label and try again.');
      return;
    }
    setError(null);
    setQr(code);
    setStep('pin');
  }

  function geo(): Promise<{ lat: number | null; lng: number | null }> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({ lat: null, lng: null });
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { timeout: 4000, maximumAge: 60_000 },
      );
    });
  }

  async function submit() {
    if (!s) return;
    setBusy(true);
    try {
      const { lat, lng } = await geo();
      const occurredAt = new Date().toISOString();
      const payload = handoffOutboxPayload({ clientUuid, shipmentId: s.id, type, qrToken: qr, pin, condition, lat, lng, occurredAt });
      await outbox.enqueue({ clientUuid, ...payload, occurredAt, label: `${type === 'PICKUP' ? 'Pickup' : 'Delivery'} · ${s.id}` });
      setStep('done');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="driver-shell">
      <ConnectionBanner status={outbox.status} pending={outbox.pending.length} needsAttention={outbox.needsAttention.length} compact />
      <main className="driver-main">
        <Link href="/driver" className="btn btn-driver-secondary"><Icon name="back" /> Back</Link>
        {ship.status === 'loading' && <DataState kind="loading" rows={3} />}
        {ship.status === 'error' && !s && <DataState kind="error" title="Could not load this shipment" onRetry={ship.reload} />}
        {s && (
          <>
            <h1 style={{ margin: 0, fontSize: 22 }}>{type === 'PICKUP' ? 'Confirm pickup' : 'Confirm delivery'} · {s.id}</h1>
            {error && <div role="alert" className="state-box" data-kind="error">{error}</div>}

            {step === 'scan' && (
              <>
                <p>Scan the QR code on the {type === 'PICKUP' ? 'cold box' : 'clinic receiving label'}.</p>
                <QrScanner onResult={onScan} />
              </>
            )}
            {step === 'pin' && (
              <>
                <p>{type === 'PICKUP' ? 'Ask the warehouse lead for the 4-digit PIN.' : 'Ask the clinic receiver for their 4-digit PIN.'}</p>
                <PinPad value={pin} onChange={setPin} label="Handoff PIN" />
                <button type="button" className="btn btn-primary" style={{ minHeight: 72 }} disabled={pin.length < 4} onClick={() => setStep('condition')}>
                  Next
                </button>
              </>
            )}
            {step === 'condition' && (
              <>
                <p>What condition is the package in?</p>
                <ConditionPicker value={condition} onChange={setCondition} />
                <button type="button" className="btn btn-primary" style={{ minHeight: 72 }} disabled={busy} onClick={submit}>
                  {busy ? 'Saving…' : 'Confirm handoff'}
                </button>
              </>
            )}
            {step === 'done' && (
              <div className="driver-card">
                <div className="section" style={{ textAlign: 'center' }}>
                  <Icon name="check" size={40} strokeWidth={2.6} style={{ color: 'var(--normal)' }} />
                  <h2 style={{ margin: '8px 0' }}>Handoff recorded</h2>
                  <p className="muted">{outbox.online ? 'Sending to the server now.' : 'Saved on this phone. It will sync when you are back online.'}</p>
                  <button type="button" className="btn btn-primary" style={{ minHeight: 56 }} onClick={() => router.replace('/driver')}>Done</button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function HandoffPage() {
  return (
    <RoleGuard route="/driver">
      <Suspense fallback={<DataState kind="loading" rows={3} />}>
        <Flow />
      </Suspense>
    </RoleGuard>
  );
}
