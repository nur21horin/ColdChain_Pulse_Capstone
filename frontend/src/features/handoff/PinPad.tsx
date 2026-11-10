'use client';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

interface Props {
  value: string;
  onChange: (pin: string) => void;
  length?: number;
  label: string;
}

/** Large, glove-friendly keypad. PINs are never stored on the device (PRD §10.2). */
export function PinPad({ value, onChange, length = 4, label }: Props) {
  const press = (d: string) => value.length < length && onChange(value + d);
  return (
    <div>
      <div className="label" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <div className="pin-dots" role="status" aria-label={`${label}: ${value.length} of ${length} digits entered`}>
        {Array.from({ length }, (_, i) => (
          <span key={i} data-filled={i < value.length} />
        ))}
      </div>
      <div className="pinpad">
        {DIGITS.map((d) => (
          <button key={d} type="button" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="word" onClick={() => onChange('')}>
          Clear
        </button>
        <button type="button" onClick={() => press('0')}>
          0
        </button>
        <button type="button" aria-label="Delete last digit" onClick={() => onChange(value.slice(0, -1))}>
          ⌫
        </button>
      </div>
    </div>
  );
}
