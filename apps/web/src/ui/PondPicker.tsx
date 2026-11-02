import { Icon } from '../icons';

export type PondOption = { id: string; code: string | null; name: string; is_active: boolean };
export const pondLabel = (p: Pick<PondOption, 'code' | 'name'>) => (p.code ? `${p.code} ${p.name}` : p.name);

export function PondPicker({ ponds, value, onChange, label = 'Settling Pond' }: { ponds: PondOption[]; value: string | null; onChange: (id: string) => void; label?: string }) {
  return (
    <label className="ui-pick">
      <span className="ui-pick__label">{label}</span>
      <span className="ui-pick__box">
        <Icon name="pin" />
        <select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {ponds.map((p) => <option key={p.id} value={p.id}>{pondLabel(p)}</option>)}
        </select>
        <Icon name="chevron-down" />
      </span>
    </label>
  );
}
