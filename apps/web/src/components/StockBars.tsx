import { formatNumber } from '@evo/shared';

export type StockItem = { type: string; remaining: number | null; max: number | null; updated: string | null };

export function StockBars({ items }: { items: StockItem[] }) {
  return (
    <div className="ui-bars">
      {items.map((it) => {
        const pct = it.remaining === null || !it.max || it.max <= 0 ? 0 : Math.max(0, Math.min(100, (it.remaining / it.max) * 100));
        return (
          <div key={it.type} className="ui-bar">
            <div className="ui-bar__head">
              <span>{it.type}</span>
              <strong>{it.remaining === null ? 'Belum ada data' : formatNumber(it.remaining)}</strong>
            </div>
            {it.remaining !== null && (
              <div className="ui-bar__track">
                <div role="meter" aria-label={it.type} aria-valuemin={0} aria-valuemax={it.max ?? 0} aria-valuenow={it.remaining}
                  className="ui-bar__fill" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      })}
      <small className="ui-muted">Batang: dibanding sisa tertinggi dalam rentang</small>
    </div>
  );
}
