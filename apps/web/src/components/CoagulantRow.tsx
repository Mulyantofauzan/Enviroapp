import { defaultRemaining, type CoagulantType } from '@evo/shared';
import { NumberField } from './NumberField';

export type CoagState = { stock_in: number | null; stock_out: number | null; stock_remaining: number | null };

type Props = {
  type: CoagulantType;
  previousRemaining: number | null;
  value: CoagState;
  onChange: (v: CoagState) => void;
  readOnly?: boolean;
};

export const effectiveRemaining = (prev: number | null, v: CoagState) =>
  v.stock_remaining ?? defaultRemaining(prev, v.stock_in ?? 0, v.stock_out ?? 0);

export function CoagulantRow({ type, previousRemaining, value, onChange, readOnly }: Props) {
  const remaining = effectiveRemaining(previousRemaining, value);
  return (
    <fieldset className="coag">
      <legend>{type}</legend>
      <div className="coag-grid">
        <NumberField label={`${type} in`} unit="kg" value={value.stock_in} readOnly={readOnly}
          onChange={(v) => onChange({ ...value, stock_in: v })} />
        <NumberField label={`${type} out`} unit="kg" value={value.stock_out} readOnly={readOnly}
          onChange={(v) => onChange({ ...value, stock_out: v })} />
        <NumberField label={`${type} remaining`} unit="kg" value={remaining} readOnly={readOnly}
          onChange={(v) => onChange({ ...value, stock_remaining: v })} />
      </div>
      {remaining < 0 && <p className="form-error">Stock is below zero. Check your count.</p>}
    </fieldset>
  );
}
