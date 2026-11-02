export type Pond = { id: string; name: string; is_active: boolean };

export function PondChips({ ponds, value, onChange }: { ponds: Pond[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <div className="chips" role="tablist" aria-label="Settling pond">
      {ponds.map((p) => (
        <button key={p.id} role="tab" aria-selected={p.id === value} className={p.id === value ? 'chip is-active' : 'chip'} onClick={() => onChange(p.id)}>
          {p.name}
        </button>
      ))}
    </div>
  );
}
