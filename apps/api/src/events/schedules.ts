import { Hono } from 'hono';
import type { Context } from 'hono';
import { EVENT_FREQUENCIES, isValidDate, startDateInRange, todayInSite } from '@evo/shared';
import type { AppEnv } from '../types';
import { requireAuth, requireScheduler } from '../auth/guard';
import { importHandler } from './import';
import { LOCKED_SQL } from './locked';

export const scheduleRoutes = new Hono<AppEnv>();
scheduleRoutes.use('*', requireAuth);

type Fail = { fail: Response };
const isFail = (v: unknown): v is Fail => typeof v === 'object' && v !== null && 'fail' in v;
const text = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

const startDateOk = (d: string) => startDateInRange(d, todayInSite());

const LOCKED_MSG = 'Frekuensi dan tanggal mulai tidak bisa diubah karena jadwal ini sudah punya catatan.';

const SELECT = `
  SELECT s.id, s.title, s.description, s.frequency, s.start_date, s.category_id, k.name AS category_name, k.color AS category_color,
    s.assigned_to, u.name AS assigned_to_name, s.ended_on,
    ${LOCKED_SQL} AS locked
  FROM event_schedules s LEFT JOIN users u ON u.id = s.assigned_to LEFT JOIN event_categories k ON k.id = s.category_id`;

const present = (r: any) => ({ ...r, locked: !!r.locked });

/** Checks the optional references (category, assignee). `category` is only checked when it is being newly set. Returns null when fine. */
async function checkRefs(c: Context<AppEnv>, category: unknown, assignee: unknown): Promise<Response | null> {
  if (category !== null && category !== undefined) {
    const k = await c.env.DB.prepare('SELECT is_active FROM event_categories WHERE id = ?').bind(category).first<{ is_active: number }>();
    if (!k) return c.json({ error: 'Kategori tidak ditemukan.' }, 404);
    if (!k.is_active) return c.json({ error: 'Kategori ini nonaktif.' }, 400);
  }
  if (assignee !== null && assignee !== undefined) {
    const u = await c.env.DB.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').bind(assignee).first();
    if (!u) return c.json({ error: 'Pengguna yang ditugaskan tidak ditemukan.' }, 400);
  }
  return null;
}

function readFields(c: Context<AppEnv>, b: any, partial: boolean): Record<string, unknown> | Fail {
  const out: Record<string, unknown> = {};
  if (!partial || b.title !== undefined) {
    const t = text(b.title);
    if (!t) return { fail: c.json({ error: 'Judul wajib diisi.' }, 400) };
    if (t.length > 120) return { fail: c.json({ error: 'Judul maksimal 120 karakter.' }, 400) };
    out.title = t;
  }
  if (b.description !== undefined) out.description = text(b.description);
  if (!partial || b.frequency !== undefined) {
    if (!(EVENT_FREQUENCIES as readonly string[]).includes(b.frequency)) return { fail: c.json({ error: 'Pilih frekuensi yang benar.' }, 400) };
    out.frequency = b.frequency;
  }
  if (!partial || b.start_date !== undefined) {
    if (!isValidDate(b.start_date)) return { fail: c.json({ error: 'Tanggal mulai harus berbentuk 2026-11-02.' }, 400) };
    if (!startDateOk(b.start_date)) return { fail: c.json({ error: 'Tanggal mulai harus antara 1 Jan 2000 dan 5 tahun dari sekarang.' }, 400) };
    out.start_date = b.start_date;
  }
  if (b.category_id !== undefined) out.category_id = text(b.category_id);
  if (b.assigned_to !== undefined) out.assigned_to = text(b.assigned_to);
  return out;
}

scheduleRoutes.get('/', async (c) => {
  const all = c.req.query('all') === '1';
  const { results } = await c.env.DB.prepare(`${SELECT} ${all ? '' : 'WHERE s.ended_on IS NULL'} ORDER BY s.title, s.start_date`).all<any>();
  return c.json(results.map(present));
});

/** Names only, so a Manager can pick who a schedule is for without being able to list accounts. */
scheduleRoutes.get('/assignees', requireScheduler, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, name FROM users WHERE is_active = 1 ORDER BY name').all<{ id: string; name: string }>();
  return c.json(results);
});

scheduleRoutes.post('/', requireScheduler, async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  const f = readFields(c, b, false);
  if (isFail(f)) return f.fail;
  const bad = await checkRefs(c, f.category_id, f.assigned_to);
  if (bad) return bad;
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO event_schedules (id,title,description,frequency,start_date,category_id,assigned_to,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
  ).bind(id, f.title, f.description ?? null, f.frequency, f.start_date, f.category_id ?? null, f.assigned_to ?? null, c.get('user').id, new Date().toISOString()).run();
  return c.json({ id }, 201);
});

scheduleRoutes.post('/import', requireScheduler, importHandler);

scheduleRoutes.patch('/:id', requireScheduler, async (c) => {
  const row = await c.env.DB.prepare(`${SELECT} WHERE s.id = ?`).bind(c.req.param('id')).first<any>();
  if (!row) return c.json({ error: 'Jadwal tidak ditemukan.' }, 404);
  const b: any = await c.req.json().catch(() => ({}));
  const f = readFields(c, b, true);
  if (isFail(f)) return f.fail;
  const changesTiming = (f.frequency !== undefined && f.frequency !== row.frequency) || (f.start_date !== undefined && f.start_date !== row.start_date);
  if (changesTiming && row.locked) return c.json({ error: LOCKED_MSG }, 409);
  // An assignee deactivated after the schedule was made can stay; only a new, unknown or inactive pick is refused.
  const bad = await checkRefs(c, f.category_id === row.category_id ? undefined : f.category_id, f.assigned_to === row.assigned_to ? undefined : f.assigned_to);
  if (bad) return bad;
  const next = { ...row, ...f };
  await c.env.DB.prepare('UPDATE event_schedules SET title = ?, description = ?, frequency = ?, start_date = ?, category_id = ?, assigned_to = ? WHERE id = ?')
    .bind(next.title, next.description ?? null, next.frequency, next.start_date, next.category_id ?? null, next.assigned_to ?? null, row.id).run();
  return c.json({ id: row.id });
});

scheduleRoutes.post('/:id/stop', requireScheduler, async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT id FROM event_schedules WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Jadwal tidak ditemukan.' }, 404);
  await c.env.DB.prepare('UPDATE event_schedules SET ended_on = COALESCE(ended_on, ?) WHERE id = ?').bind(todayInSite(), id).run();
  const r = await c.env.DB.prepare('SELECT ended_on FROM event_schedules WHERE id = ?').bind(id).first<{ ended_on: string }>();
  return c.json({ ended_on: r!.ended_on });
});
