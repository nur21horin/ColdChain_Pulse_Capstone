'use client';

import type { Condition } from '@/types/domain';

const OPTIONS: { value: Condition; label: string }[] = [
  { value: 'OK', label: 'OK' },
  { value: 'TEMP_SUSPECT', label: 'Temp suspect' },
  { value: 'DAMAGED', label: 'Damaged' },
];

export function ConditionPicker({ value, onChange }: { value: Condition; onChange: (c: Condition) => void }) {
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className="label" style={{ marginBottom: 8, padding: 0 }}>
        Condition on arrival
      </legend>
      <div className="conditions">
        {OPTIONS.map((o) => (
          <button key={o.value} type="button" data-value={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
