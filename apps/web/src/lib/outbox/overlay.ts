import { COAGULANT_TYPES, defaultRemaining } from '@evo/shared';
import type { DayData } from '../../hooks/useDay';
import type { OutboxItem } from './db';

const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/** Puts entries still waiting in the outbox over what the server returned, so the screen shows what the user typed. */
export function applyPending(data: DayData, items: OutboxItem[], date: string, sp: string): DayData {
  const waiting = new Map(items.filter((i) => i.status === 'pending').map((i) => [i.key, i.request.body ?? {}]));
  if (waiting.size === 0) return data;
  const out: DayData = { ...data, coagulant: { ...data.coagulant } };

  const w = waiting.get(`weather|${date}`);
  if (w) out.weather = { rainfall_mm: num(w.rainfall_mm), rain_hours: num(w.rain_hours) };

  const a = waiting.get(`water|${date}|${sp}`);
  if (a) {
    out.water = {
      ph_inlet: num(a.ph_inlet), ph_outlet: num(a.ph_outlet), tss_inlet: num(a.tss_inlet), tss_outlet: num(a.tss_outlet),
      debit_inlet_m3s: num(a.debit_inlet_m3s), debit_outlet_m3s: num(a.debit_outlet_m3s),
    };
  }

  for (const t of COAGULANT_TYPES) {
    const c = waiting.get(`coagulant|${date}|${sp}|${t}`);
    if (!c) continue;
    const stockIn = num(c.stock_in), stockOut = num(c.stock_out);
    out.coagulant[t] = {
      stock_in: stockIn, stock_out: stockOut,
      stock_remaining: num(c.stock_remaining) ?? defaultRemaining(data.previousRemaining[t], stockIn ?? 0, stockOut ?? 0),
    };
  }
  return out;
}
