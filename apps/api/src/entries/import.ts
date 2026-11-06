import { Hono } from 'hono';
import type { Context } from 'hono';
import { COAGULANT_TYPES, DAILY_IMPORT_MAX_ROWS, defaultRemaining, normalizeKey, todayInSite, validateDailyRow, type CoagulantType, type DailyInputRow, type DailyRowOk } from '@evo/shared';
import type { AppEnv } from '../types';
import { requireAdmin, requireAuth } from '../auth/guard';
import { previousRemaining } from './coagulant';

export const entryImportRoutes = new Hono<AppEnv>();
entryImportRoutes.use('*', requireAuth, requireAdmin);

type Part = 'cuaca' | 'air' | 'koagulan';
type Status = 'create' | 'update' | 'unchanged' | 'error';
export type DailyRowResult = { row: number; date: string; pond: string; status: Status; message?: string; parts: Part[] };

const WRITE_CHUNK = 100;
const KEYS = ['row', 'date', 'pond', 'rainfall', 'rain_hours', 'ph_inlet', 'ph_outlet', 'tss_inlet', 'tss_outlet', 'debit_inlet', 'debit_outlet', 'serbuk_in', 'serbuk_out', 'batu_in', 'batu_out', 'kapur_in', 'kapur_out'] as const;
const cell = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const same = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 1e-9);

function toInput(item: unknown, i: number): DailyInputRow {
  const o = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of KEYS) out[k] = k === 'row' ? (typeof o.row === 'number' ? o.row : i + 2) : cell(o[k]);
  return out as DailyInputRow;
}

type Pond = { id: string; code: string | null; is_active: number };
type WeatherRow = { date: string; rainfall_mm: number | null; rain_hours: number | null };
type WaterRow = { date: string; sp_id: string; ph_inlet: number | null; ph_outlet: number | null; tss_inlet: number | null; tss_outlet: number | null; debit_inlet_m3s: number | null; debit_outlet_m3s: number | null };
type CoagRow = { date: string; sp_id: string; type: CoagulantType; stock_in: number | null; stock_out: number | null; stock_remaining: number | null };
const WATER_KEYS = ['ph_inlet', 'ph_outlet', 'tss_inlet', 'tss_outlet', 'debit_inlet_m3s', 'debit_outlet_m3s'] as const;

/** POST /entries/import. Judges every row and, unless `dry`, saves the rows that are fine. */
export async function importDaily(c: Context<AppEnv>) {
  const b: any = await c.req.json().catch(() => ({}));
  const raw: unknown[] = Array.isArray(b.rows) ? b.rows : [];
  if (raw.length < 1 || raw.length > DAILY_IMPORT_MAX_ROWS) return c.json({ error: `Berkas harus berisi 1 sampai ${DAILY_IMPORT_MAX_ROWS} baris.` }, 400);
  const dry = b.dry === true;
  const today = todayInSite();
  const db = c.env.DB;
  const by = c.get('user').id;

  const ponds = (await db.prepare('SELECT id, code, is_active FROM settling_ponds').all<Pond>()).results;
  const pondByCode = new Map(ponds.filter((p) => p.code).map((p) => [normalizeKey(p.code!), p]));

  type Item = { input: DailyRowOk | null; row: number; date: string; pond: string; pondId: string; result: DailyRowResult };
  const items: Item[] = raw.map((r, i) => {
    const input = toInput(r, i);
    const base = { row: input.row, date: (input.date ?? '').trim(), pond: (input.pond ?? '').trim() };
    const item: Item = { input: null, ...base, pondId: '', result: { ...base, status: 'error', parts: [] } };
    const fail = (message: string) => { item.result = { ...base, status: 'error', message, parts: [] }; return item; };
    const v = validateDailyRow(input, today);
    if (!v.ok) return fail(v.error);
    const pond = pondByCode.get(normalizeKey(v.pond));
    if (!pond) return fail(`Pond dengan kode ${v.pond} tidak ditemukan.`);
    if (!pond.is_active) return fail(`Pond ${v.pond} nonaktif.`);
    item.input = v;
    item.date = v.date;
    item.pondId = pond.id;
    return item;
  });
  const failRow = (it: Item, message: string) => { it.input = null; it.result = { row: it.row, date: it.date, pond: it.pond, status: 'error', message, parts: [] }; };

  const firstAt = new Map<string, number>();
  for (const it of items) {
    if (!it.input) continue;
    const k = `${it.date}|${it.pondId}`;
    const first = firstAt.get(k);
    if (first !== undefined) failRow(it, `Baris ganda dengan baris ${first}.`); else firstAt.set(k, it.row);
  }

  const byDate = new Map<string, Item[]>();
  for (const it of items) if (it.input) (byDate.get(it.date) ?? byDate.set(it.date, []).get(it.date)!).push(it);
  const weatherOf = new Map<string, { rainfall_mm: number | null; rain_hours: number | null }>();
  for (const [date, group] of byDate) {
    const carrying = group.filter((it) => it.input!.weather.rainfall_mm !== null || it.input!.weather.rain_hours !== null);
    const conflict = carrying.filter((a) => carrying.some((o) => o !== a
      && ((a.input!.weather.rainfall_mm !== null && o.input!.weather.rainfall_mm !== null && !same(a.input!.weather.rainfall_mm, o.input!.weather.rainfall_mm))
        || (a.input!.weather.rain_hours !== null && o.input!.weather.rain_hours !== null && !same(a.input!.weather.rain_hours, o.input!.weather.rain_hours)))));
    if (conflict.length) {
      for (const a of conflict) {
        const other = conflict.find((o) => o !== a)!;
        failRow(a, `Curah hujan atau jam hujan tanggal ini berbeda dengan baris ${other.row}.`);
      }
      continue;
    }
    const pick = (k: 'rainfall_mm' | 'rain_hours') => carrying.map((it) => it.input!.weather[k]).find((v) => v !== null) ?? null;
    weatherOf.set(date, { rainfall_mm: pick('rainfall_mm'), rain_hours: pick('rain_hours') });
  }

  const live = items.filter((it) => it.input);
  const stmts: D1PreparedStatement[] = [];
  const state = new Map<Item, Status[]>();

  if (live.length) {
    const dates = live.map((it) => it.date).sort();
    const from = dates[0], to = dates[dates.length - 1];
    const pondIds = [...new Set(live.map((it) => it.pondId))];
    const marks = pondIds.map(() => '?').join(',');
    const weatherDb = new Map((await db.prepare('SELECT date, rainfall_mm, rain_hours FROM weather WHERE date BETWEEN ? AND ?').bind(from, to).all<WeatherRow>()).results.map((w) => [w.date, w]));
    const waterDb = new Map((await db.prepare(`SELECT date, sp_id, ph_inlet, ph_outlet, tss_inlet, tss_outlet, debit_inlet_m3s, debit_outlet_m3s FROM surface_water WHERE date BETWEEN ? AND ? AND sp_id IN (${marks})`)
      .bind(from, to, ...pondIds).all<WaterRow>()).results.map((w) => [`${w.date}|${w.sp_id}`, w]));
    const coagDb = (await db.prepare(`SELECT date, sp_id, type, stock_in, stock_out, stock_remaining FROM coagulant WHERE date BETWEEN ? AND ? AND sp_id IN (${marks}) ORDER BY date`)
      .bind(from, to, ...pondIds).all<CoagRow>()).results;

    const weatherWritten = new Map<string, Status>();
    for (const it of live) {
      const v = it.input!;
      const parts: Status[] = [];
      state.set(it, parts);

      const w = weatherOf.get(it.date);
      if (w && (v.weather.rainfall_mm !== null || v.weather.rain_hours !== null)) {
        let s = weatherWritten.get(it.date);
        if (!s) {
          const ex = weatherDb.get(it.date);
          const rain = w.rainfall_mm ?? ex?.rainfall_mm ?? null, hours = w.rain_hours ?? ex?.rain_hours ?? null;
          s = !ex ? 'create' : same(rain, ex.rainfall_mm) && same(hours, ex.rain_hours) ? 'unchanged' : 'update';
          weatherWritten.set(it.date, s);
          if (s !== 'unchanged') {
            stmts.push(db.prepare(`INSERT INTO weather (id,date,rainfall_mm,rain_hours,logged_by) VALUES (?,?,?,?,?)
              ON CONFLICT(date) DO UPDATE SET rainfall_mm=excluded.rainfall_mm, rain_hours=excluded.rain_hours, logged_by=excluded.logged_by`)
              .bind(crypto.randomUUID(), it.date, rain, hours, by));
          }
        }
        parts.push(s);
      }

      if (WATER_KEYS.some((k) => v.water[k] !== null)) {
        const ex = waterDb.get(`${it.date}|${it.pondId}`);
        const merged = Object.fromEntries(WATER_KEYS.map((k) => [k, v.water[k] ?? ex?.[k] ?? null])) as Record<(typeof WATER_KEYS)[number], number | null>;
        const s: Status = !ex ? 'create' : WATER_KEYS.every((k) => same(merged[k], ex[k])) ? 'unchanged' : 'update';
        parts.push(s);
        if (s !== 'unchanged') {
          stmts.push(db.prepare(`INSERT INTO surface_water (id,date,sp_id,ph_inlet,ph_outlet,tss_inlet,tss_outlet,debit_inlet_m3s,debit_outlet_m3s,logged_by) VALUES (?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(date,sp_id) DO UPDATE SET ph_inlet=excluded.ph_inlet, ph_outlet=excluded.ph_outlet, tss_inlet=excluded.tss_inlet, tss_outlet=excluded.tss_outlet,
              debit_inlet_m3s=excluded.debit_inlet_m3s, debit_outlet_m3s=excluded.debit_outlet_m3s, logged_by=excluded.logged_by`)
            .bind(crypto.randomUUID(), it.date, it.pondId, merged.ph_inlet, merged.ph_outlet, merged.tss_inlet, merged.tss_outlet, merged.debit_inlet_m3s, merged.debit_outlet_m3s, by));
        }
      }
    }

    // Remaining stock is chained per pond and type in date order, starting from what is already stored.
    for (const pondId of pondIds) for (const type of COAGULANT_TYPES) {
      const mine = live.filter((it) => it.pondId === pondId && it.input!.coagulant[type]).sort((a, b) => (a.date < b.date ? -1 : 1));
      if (!mine.length) continue;
      const series = new Map<string, number | null>([['0000-00-00', await previousRemaining(db, pondId, type, mine[0].date)]]);
      const existing = new Map<string, CoagRow>();
      for (const r of coagDb) if (r.sp_id === pondId && r.type === type) { existing.set(r.date, r); series.set(r.date, r.stock_remaining); }
      for (const it of mine) {
        const c = it.input!.coagulant[type]!;
        const ex = existing.get(it.date);
        const stockIn = c.stock_in ?? ex?.stock_in ?? null, stockOut = c.stock_out ?? ex?.stock_out ?? null;
        let s: Status;
        if (ex && same(stockIn, ex.stock_in) && same(stockOut, ex.stock_out)) {
          s = 'unchanged';
        } else {
          const prevDate = [...series.keys()].filter((d) => d < it.date).sort().pop()!;
          const remaining = defaultRemaining(series.get(prevDate) ?? null, stockIn ?? 0, stockOut ?? 0);
          series.set(it.date, remaining);
          s = ex ? 'update' : 'create';
          stmts.push(db.prepare(`INSERT INTO coagulant (id,date,sp_id,type,stock_in,stock_out,stock_remaining,logged_by) VALUES (?,?,?,?,?,?,?,?)
            ON CONFLICT(date,sp_id,type) DO UPDATE SET stock_in=excluded.stock_in, stock_out=excluded.stock_out, stock_remaining=excluded.stock_remaining, logged_by=excluded.logged_by`)
            .bind(crypto.randomUUID(), it.date, pondId, type, stockIn, stockOut, remaining, by));
        }
        state.get(it)!.push(s);
      }
    }
  }

  for (const it of live) {
    const v = it.input!;
    const st = state.get(it) ?? [];
    const parts: Part[] = [];
    if (v.weather.rainfall_mm !== null || v.weather.rain_hours !== null) parts.push('cuaca');
    if (WATER_KEYS.some((k) => v.water[k] !== null)) parts.push('air');
    if (Object.keys(v.coagulant).length) parts.push('koagulan');
    const status: Status = st.includes('create') ? 'create' : st.includes('update') ? 'update' : 'unchanged';
    it.result = { row: it.row, date: it.date, pond: it.pond, status, parts };
  }

  if (!dry) for (let i = 0; i < stmts.length; i += WRITE_CHUNK) await db.batch(stmts.slice(i, i + WRITE_CHUNK));

  const rows = items.map((it) => it.result);
  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  return c.json({ summary: { create: count('create'), update: count('update'), unchanged: count('unchanged'), error: count('error') }, rows });
}

entryImportRoutes.post('/import', importDaily);
