import { useEffect, useId, useRef, useState } from 'react';
import { formatNumber, isOutOfLimit, parseLocaleNumber, type Threshold } from '@evo/shared';

type Props = {
  label: string;
  unit?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  threshold?: Threshold;
  auto?: boolean;
  readOnly?: boolean;
  hint?: string;
};

const editText = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));

function limitText(t: Threshold): string {
  if (t.min !== null && t.max !== null) return `Di luar baku mutu ${formatNumber(t.min)}-${formatNumber(t.max)}`;
  if (t.max !== null) return `Di luar baku mutu (maks. ${formatNumber(t.max)})`;
  return `Di luar baku mutu (min. ${formatNumber(t.min)})`;
}

export function NumberInput({ label, unit, value, onChange, threshold, auto, readOnly, hint }: Props) {
  const showFormatted = !!(auto && readOnly);
  const [text, setText] = useState(editText(value));
  const wasAlert = useRef(false);
  const id = useId();

  useEffect(() => {
    const parsed = parseLocaleNumber(text);
    if (parsed !== value && !(parsed === 'invalid' && value === null)) setText(editText(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = parseLocaleNumber(text);
  const invalid = parsed === 'invalid';
  const alert = !invalid && isOutOfLimit(parsed, threshold);
  const pulse = alert && !wasAlert.current;
  wasAlert.current = alert;

  return (
    <div className="ui-num">
      <div className="ui-num__top">
        <label htmlFor={id}>{label}</label>
        {auto && <span className="ui-chip-auto">Otomatis</span>}
      </div>
      <div className={`ui-num__box${alert ? ' is-alert' : ''}${invalid ? ' is-invalid' : ''}${auto ? ' is-auto' : ''}`}>
        <input
          id={id}
          className={`${alert ? 'is-alert' : ''}${pulse ? ' pulse' : ''}`.trim()}
          type="text"
          inputMode="decimal"
          value={showFormatted ? formatNumber(value, 1) : text}
          readOnly={readOnly}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            setText(e.target.value);
            const p = parseLocaleNumber(e.target.value);
            if (p !== 'invalid') onChange(p);
          }}
        />
        {unit && <span className="ui-num__unit">{unit}</span>}
      </div>
      {invalid && <small className="ui-num__error">Masukkan angka</small>}
      {!invalid && alert && threshold && <small className="ui-num__error">{limitText(threshold)}</small>}
      {hint && !invalid && !alert && <small className="ui-num__hint">{hint}</small>}
    </div>
  );
}
