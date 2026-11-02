export function SaveBar({ onSave, busy }: { onSave: () => void; busy: boolean }) {
  return (
    <div className="savebar">
      <button className="btn-primary" onClick={onSave} disabled={busy}>{busy ? 'Saving…' : 'Save day'}</button>
    </div>
  );
}
