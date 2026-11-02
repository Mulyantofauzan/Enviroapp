import { useEffect, useRef, useState } from 'react';
import { isOutOfLimit, parseNumber, type Threshold } from '@evo/shared';

type Props = {
  label: string;
  unit?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  threshold?: Threshold;
  readOnly?: boolean;
};

const show = (v: number | null) => (v === null ? '' : String(v));

export function NumberField({ label, unit, value, onChange, threshold, readOnly }: Props) {
  const [text, setText] = useState(show(value));
  const wasAlert = useRef(false);

  useEffect(() => {
    const parsed = parseNumber(text);
    if (parsed !== value && !(parsed === 'invalid' && value === null)) setText(show(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = parseNumber(text);
  const invalid = parsed === 'invalid';
  const alert = !invalid && isOutOfLimit(parsed, threshold);
  const pulse = alert && !wasAlert.current;
  wasAlert.current = alert;

  return (
    <div className="field-unit">
      <label className="field" style={{ flex: 1 }}>
        <span>{label}</span>
        <input
          className={`num${alert ? ' is-alert' : ''}${pulse ? ' pulse' : ''}`}
          type="text"
          inputMode="decimal"
          value={text}
          readOnly={readOnly}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            const raw = e.target.value.replace(',', '.');
            setText(raw);
            const p = parseNumber(raw);
            if (p !== 'invalid') onChange(p);
          }}
        />
        {invalid && <small className="field-error">Enter a number</small>}
      </label>
      {unit && <span className="unit">{unit}</span>}
    </div>
  );
}
