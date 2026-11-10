'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Shipment } from '@/types/domain';
import { api } from '@/lib/api/client';
import { newShipmentFormSchema } from '@/lib/api/schemas';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (s: Shipment) => void;
}

type Errors = Partial<Record<'batchNo' | 'product' | 'originName' | 'clinicName' | 'minTempC' | 'maxTempC' | 'form', string>>;

/** DSP-1: create a shipment with a target range (default 2–8 °C). */
export function NewShipmentDialog({ open, onClose, onCreated }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const parsed = newShipmentFormSchema.safeParse(data);
    if (!parsed.success) {
      const errs: Errors = {};
      for (const issue of parsed.error.issues) errs[issue.path[0] as keyof Errors] ??= issue.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const s = await api.createShipment(parsed.data);
      onCreated(s);
      form.reset();
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Could not create the shipment' });
    } finally {
      setBusy(false);
    }
  }

  const field = (name: keyof Errors, label: string, props: Record<string, unknown> = {}) => (
    <label className="field">
      {label}
      <input className="input" name={name} aria-invalid={errors[name] ? true : undefined} aria-describedby={errors[name] ? `${name}-err` : undefined} {...props} />
      {errors[name] && (
        <span className="field-error" id={`${name}-err`}>
          {errors[name]}
        </span>
      )}
    </label>
  );

  return (
    <dialog ref={ref} className="modal" onClose={onClose} aria-labelledby="new-shipment-title">
      <form className="modal-body" onSubmit={submit} noValidate>
        <h2 id="new-shipment-title" style={{ margin: 0, fontSize: 20 }}>
          New shipment
        </h2>
        {errors.form && (
          <div className="notice" data-tone="error" role="alert">
            {errors.form}
          </div>
        )}
        <div className="form-grid">
          {field('batchNo', 'Batch number', { placeholder: 'BCG-2611-08', required: true })}
          {field('product', 'Product', { placeholder: 'BCG vaccine', required: true })}
          {field('originName', 'Origin warehouse', { defaultValue: 'Tejgaon Central Warehouse', required: true })}
          {field('clinicName', 'Destination clinic', { placeholder: 'Kapasia UHC', required: true })}
          {field('minTempC', 'Min °C', { type: 'number', step: '0.1', defaultValue: 2, inputMode: 'decimal' })}
          {field('maxTempC', 'Max °C', { type: 'number', step: '0.1', defaultValue: 8, inputMode: 'decimal' })}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create shipment'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
