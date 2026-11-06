import { parseDateCell } from './import';
import { lsToM3s } from './math';
import type { CoagulantType } from './types';

export const DAILY_IMPORT_MAX_ROWS = 1000;

/** One spreadsheet row, every cell as text. `row` is the Excel row number. */
export type DailyInputRow = {
  row: number; date: string | null; pond: string | null;
  rainfall: string | null; rain_hours: string | null;
  ph_inlet: string | null; ph_outlet: string | null; tss_inlet: string | null; tss_outlet: string | null;
  debit_inlet: string | null; debit_outlet: string | null;
  serbuk_in: string | null; serbuk_out: string | null; batu_in: string | null; batu_out: string | null; kapur_in: string | null; kapur_out: string | null;
};

export type DailyRowOk = {
  ok: true; date: string; pond: string;
  weather: { rainfall_mm: number | null; rain_hours: number | null };
  water: { ph_inlet: number | null; ph_outlet: number | null; tss_inlet: number | null; tss_outlet: number | null; debit_inlet_m3s: number | null; debit_outlet_m3s: number | null };
  coagulant: Partial<Record<CoagulantType, { stock_in: number | null; stock_out: number | null }>>;
};
export type DailyRowBad = { ok: false; error: string };

const MARKERS = new Set(['', 'no data', 'no flow', '-']);
/** Empty, "no data", "no flow" and "-" all mean "no value". */
export const isBlankCell = (raw: string | null): boolean => raw === null || MARKERS.has(raw.trim().toLowerCase());

const count = (s: string, ch: string) => s.split(ch).length - 1;

/**
 * Reads a number typed in the Indonesian or the English way. With both separators the last one is the decimal point.
 * A single dot is a decimal point ("1.234" is 1.234), because that is how Excel stores real numbers.
 */
export function parseFlexibleNumber(raw: string): number | 'invalid' {
  const s = raw.trim();
  if (s === '') return 'invalid';
  const dots = count(s, '.'), commas = count(s, ',');
  let plain: string;
  if (dots > 0 && commas > 0) {
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const thousands = dec === '.' ? ',' : '.';
    if (count(s, dec) !== 1) return 'invalid';
    const [int, frac] = s.split(dec);
    const groups = new RegExp(`^-?\\d{1,3}(\\${thousands}\\d{3})+$`);
    if (!groups.test(int) || !/^\d+$/.test(frac)) return 'invalid';
    plain = `${int.split(thousands).join('')}.${frac}`;
  } else if (dots > 1 || commas > 1) {
    const t = dots > 1 ? '.' : ',';
    if (!new RegExp(`^-?\\d{1,3}(\\${t}\\d{3})+$`).test(s)) return 'invalid';
    plain = s.split(t).join('');
  } else if (dots === 1 || commas === 1) {
    if (!/^-?\d+[.,]\d+$/.test(s)) return 'invalid';
    plain = s.replace(',', '.');
  } else {
    if (!/^-?\d+$/.test(s)) return 'invalid';
    plain = s;
  }
  const n = Number(plain);
  return Number.isFinite(n) ? n : 'invalid';
}

type Rule = { label: string; min: number; max?: number };
const rangeMsg = (r: Rule) => (r.max !== undefined ? `${r.label} harus antara ${r.min} dan ${r.max}.` : `${r.label} harus ${r.min} atau lebih.`);

function num(raw: string | null, rule: Rule): { v: number | null } | { error: string } {
  if (isBlankCell(raw)) return { v: null };
  const n = parseFlexibleNumber(raw!);
  if (n === 'invalid') return { error: `${rule.label} harus berupa angka.` };
  if (n < rule.min || (rule.max !== undefined && n > rule.max)) return { error: rangeMsg(rule) };
  return { v: n };
}

const PH = { min: 0, max: 14 };
const POS = { min: 0 };

export function validateDailyRow(r: DailyInputRow, today: string): DailyRowOk | DailyRowBad {
  const dateText = (r.date ?? '').trim();
  if (!dateText) return { ok: false, error: 'Tanggal wajib diisi.' };
  const date = parseDateCell(dateText);
  if (!date) return { ok: false, error: 'Tanggal tidak dikenali.' };
  if (date < '2000-01-01') return { ok: false, error: 'Tanggal tidak boleh sebelum 1 Jan 2000.' };
  if (date > today) return { ok: false, error: 'Tanggal tidak boleh di masa depan.' };
  const pond = (r.pond ?? '').trim();
  if (!pond) return { ok: false, error: 'Pond wajib diisi.' };

  const fields = {
    rainfall_mm: num(r.rainfall, { label: 'Curah hujan', ...POS }),
    rain_hours: num(r.rain_hours, { label: 'Jam hujan', min: 0, max: 24 }),
    ph_inlet: num(r.ph_inlet, { label: 'pH inlet', ...PH }),
    ph_outlet: num(r.ph_outlet, { label: 'pH outlet', ...PH }),
    tss_inlet: num(r.tss_inlet, { label: 'TSS inlet', ...POS }),
    tss_outlet: num(r.tss_outlet, { label: 'TSS outlet', ...POS }),
    debit_inlet: num(r.debit_inlet, { label: 'Debit inlet', ...POS }),
    debit_outlet: num(r.debit_outlet, { label: 'Debit outlet', ...POS }),
    serbuk_in: num(r.serbuk_in, { label: 'Tawas Serbuk masuk', ...POS }),
    serbuk_out: num(r.serbuk_out, { label: 'Tawas Serbuk keluar', ...POS }),
    batu_in: num(r.batu_in, { label: 'Tawas Batu masuk', ...POS }),
    batu_out: num(r.batu_out, { label: 'Tawas Batu keluar', ...POS }),
    kapur_in: num(r.kapur_in, { label: 'Kapur masuk', ...POS }),
    kapur_out: num(r.kapur_out, { label: 'Kapur keluar', ...POS }),
  };
  for (const f of Object.values(fields)) if ('error' in f) return { ok: false, error: f.error };
  const v = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, (f as { v: number | null }).v])) as Record<keyof typeof fields, number | null>;

  const coagulant: DailyRowOk['coagulant'] = {};
  const pair = (type: CoagulantType, stock_in: number | null, stock_out: number | null) => {
    if (stock_in !== null || stock_out !== null) coagulant[type] = { stock_in, stock_out };
  };
  pair('Tawas Serbuk', v.serbuk_in, v.serbuk_out);
  pair('Tawas Batu', v.batu_in, v.batu_out);
  pair('Kapur', v.kapur_in, v.kapur_out);

  return {
    ok: true, date, pond,
    weather: { rainfall_mm: v.rainfall_mm, rain_hours: v.rain_hours },
    water: {
      ph_inlet: v.ph_inlet, ph_outlet: v.ph_outlet, tss_inlet: v.tss_inlet, tss_outlet: v.tss_outlet,
      debit_inlet_m3s: v.debit_inlet === null ? null : lsToM3s(v.debit_inlet),
      debit_outlet_m3s: v.debit_outlet === null ? null : lsToM3s(v.debit_outlet),
    },
    coagulant,
  };
}
