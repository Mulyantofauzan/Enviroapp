type Opt<T extends string> = { value: T; label: string };

export function Segmented<T extends string>({ options, value, onChange, label }: { options: Opt<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="ui-seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} className={o.value === value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
