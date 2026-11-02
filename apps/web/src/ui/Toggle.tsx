export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`ui-toggle${checked ? ' is-on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="ui-toggle__knob" />
    </button>
  );
}
