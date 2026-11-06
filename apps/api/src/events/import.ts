import type { Context } from 'hono';
import { nextPaletteColor, normalizeKey, todayInSite, validateImportRow, type EventFrequency, type ImportInputRow } from '@evo/shared';
import type { AppEnv } from '../types';
import { LOCKED_SQL } from './locked';

const MAX_ROWS = 500;
const LOCKED_MSG = 'Sudah punya catatan, frekuensi dan tanggal mulai tidak bisa diubah.';

export type ImportStatus = 'create' | 'update' | 'unchanged' | 'skipped' | 'error';
export type ImportRowResult = { row: number; title: string; category: string | null; status: ImportStatus; message?: string; newCategory?: boolean };

type Cat = { id: string; name: string; color: string; is_active: number };
type Existing = { id: string; frequency: EventFrequency; start_date: string; category_id: string | null; locked: number };

const cell = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

/** POST /schedules/import. Judges every row against the rules and, unless `dry`, saves the rows that are fine. */
export async function importHandler(c: Context<AppEnv>) {
  const b: any = await c.req.json().catch(() => ({}));
  const raw: unknown[] = Array.isArray(b.rows) ? b.rows : [];
  if (raw.length < 1 || raw.length > MAX_ROWS) return c.json({ error: 'Berkas harus berisi 1 sampai 500 baris.' }, 400);
  const dry = b.dry === true;
  const today = todayInSite();
  const db = c.env.DB;
  const by = c.get('user').id;
  const now = new Date().toISOString();

  const cats = (await db.prepare('SELECT id, name, color, is_active FROM event_categories').all<Cat>()).results;
  const catByKey = new Map(cats.map((k) => [normalizeKey(k.name), k]));
  const usedColors = cats.filter((k) => k.is_active).map((k) => k.color);
  const existing = (await db.prepare(
    `SELECT s.id, s.title, s.frequency, s.start_date, s.category_id, ${LOCKED_SQL} AS locked FROM event_schedules s WHERE s.ended_on IS NULL`,
  ).all<Existing & { title: string }>()).results;
  const existingByKey = new Map(existing.map((s) => [`${normalizeKey(s.title)}|${s.category_id ?? ''}`, s]));

  const newCats = new Map<string, Cat>();
  const seen = new Map<string, number>();
  const stmts: D1PreparedStatement[] = [];
  const results: ImportRowResult[] = [];

  raw.forEach((item, i) => {
    const o = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const input: ImportInputRow = { row: typeof o.row === 'number' ? o.row : i + 2, category: cell(o.category), title: cell(o.title) ?? '', frequency: cell(o.frequency), start: cell(o.start) };
    const base = { row: input.row, title: input.title.trim(), category: input.category?.trim() || null };
    const v = validateImportRow(input, today);
    if (!v.ok) { results.push({ ...base, status: 'error', message: v.error }); return; }
    const res = { row: input.row, title: v.title, category: v.category };

    const dupKey = `${normalizeKey(v.title)}|${normalizeKey(v.category ?? '')}`;
    const first = seen.get(dupKey);
    if (first !== undefined) { results.push({ ...res, status: 'error', message: `Baris ganda dengan baris ${first}.` }); return; }
    seen.set(dupKey, input.row);

    const catKey = v.category ? normalizeKey(v.category) : null;
    const known = catKey ? catByKey.get(catKey) : undefined;
    const match = existingByKey.get(`${normalizeKey(v.title)}|${known?.id ?? ''}`);
    if (match && !(catKey && !known)) {
      if (match.frequency === v.frequency && match.start_date === v.start_date) { results.push({ ...res, status: 'unchanged' }); return; }
      if (match.locked) { results.push({ ...res, status: 'skipped', message: LOCKED_MSG }); return; }
      stmts.push(db.prepare('UPDATE event_schedules SET frequency = ?, start_date = ? WHERE id = ?').bind(v.frequency, v.start_date, match.id));
      results.push({ ...res, status: 'update' });
      return;
    }

    let categoryId: string | null = known?.id ?? null;
    let isNew = false;
    if (catKey && !known) {
      let k = newCats.get(catKey);
      if (!k) {
        k = { id: crypto.randomUUID(), name: v.category!, color: nextPaletteColor([...usedColors, ...[...newCats.values()].map((x) => x.color)]), is_active: 1 };
        newCats.set(catKey, k);
      }
      categoryId = k.id;
      isNew = true;
    }
    stmts.push(db.prepare('INSERT INTO event_schedules (id,title,frequency,start_date,category_id,created_by,created_at) VALUES (?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), v.title, v.frequency, v.start_date, categoryId, by, now));
    results.push({ ...res, status: 'create', ...(isNew ? { newCategory: true } : {}) });
  });

  if (!dry && stmts.length > 0) {
    const catStmts = [...newCats.values()].map((k) => db.prepare('INSERT INTO event_categories (id,name,color,created_at) VALUES (?,?,?,?)').bind(k.id, k.name, k.color, now));
    await db.batch([...catStmts, ...stmts]);
  }

  const count = (s: ImportStatus) => results.filter((r) => r.status === s).length;
  return c.json({
    summary: { create: count('create'), update: count('update'), unchanged: count('unchanged'), skipped: count('skipped'), error: count('error'), newCategories: [...newCats.values()].map((k) => k.name) },
    rows: results,
  });
}
