import { COAGULANT_TYPES, defaultRemaining, type CoagulantType } from '@evo/shared';
import type { DayData } from '../../hooks/useDay';

export type CoagState = { stock_in: number | null; stock_out: number | null; stock_remaining: number | null };
export const emptyCoag: CoagState = { stock_in: null, stock_out: null, stock_remaining: null };

/** `stock_remaining` here is only a value the operator typed; null means "use the calculation". */
export const effectiveRemaining = (prev: number | null, v: CoagState) =>
  v.stock_remaining ?? defaultRemaining(prev, v.stock_in ?? 0, v.stock_out ?? 0);

export function initialCoag(data: DayData): Record<CoagulantType, CoagState> {
  return Object.fromEntries(COAGULANT_TYPES.map((t) => {
    const r = data.coagulant[t];
    if (!r) return [t, emptyCoag];
    const calc = effectiveRemaining(data.previousRemaining[t], { stock_in: r.stock_in, stock_out: r.stock_out, stock_remaining: null });
    const typed = r.stock_remaining !== null && r.stock_remaining !== calc ? r.stock_remaining : null;
    return [t, { stock_in: r.stock_in, stock_out: r.stock_out, stock_remaining: typed }];
  })) as Record<CoagulantType, CoagState>;
}

export const hasInvalid = (root: HTMLElement | null) => !!root?.querySelector('[aria-invalid="true"]');
