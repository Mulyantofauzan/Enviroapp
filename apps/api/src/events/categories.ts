import { Hono } from 'hono';
import { CATEGORY_PALETTE } from '@evo/shared';
import type { AppEnv } from '../types';
import { requireAuth, requireScheduler } from '../auth/guard';

export const categoryRoutes = new Hono<AppEnv>();
categoryRoutes.use('*', requireAuth);

/** Trimmed, inner spaces squeezed to one; null when blank. */
export const readCategoryName = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  return s === '' ? null : s;
};

const NAME_MSG = 'Nama kategori wajib diisi, maksimal 60 karakter.';
const isUniqueError = (e: unknown) => /UNIQUE|constraint/i.test(String((e as Error)?.message ?? e));

categoryRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT k.id, k.name, k.color, k.is_active,
       (SELECT COUNT(*) FROM event_schedules s WHERE s.category_id = k.id AND s.ended_on IS NULL) AS event_count
     FROM event_categories k ORDER BY k.name COLLATE NOCASE`,
  ).all<any>();
  return c.json(results.map((r) => ({ id: r.id, name: r.name, color: r.color, is_active: !!r.is_active, event_count: r.event_count })));
});

categoryRoutes.post('/', requireScheduler, async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  const name = readCategoryName(b.name);
  if (!name || name.length > 60) return c.json({ error: NAME_MSG }, 400);
  if (!CATEGORY_PALETTE.includes(b.color)) return c.json({ error: 'Pilih warna dari palet.' }, 400);
  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare('INSERT INTO event_categories (id,name,color,created_at) VALUES (?,?,?,?)').bind(id, name, b.color, new Date().toISOString()).run();
  } catch (e) {
    if (isUniqueError(e)) return c.json({ error: 'Nama kategori sudah dipakai.' }, 409);
    throw e;
  }
  return c.json({ id }, 201);
});

categoryRoutes.patch('/:id', requireScheduler, async (c) => {
  const row = await c.env.DB.prepare('SELECT id, name, color, is_active FROM event_categories WHERE id = ?').bind(c.req.param('id')).first<any>();
  if (!row) return c.json({ error: 'Kategori tidak ditemukan.' }, 404);
  const b: any = await c.req.json().catch(() => ({}));
  let name = row.name as string;
  if (b.name !== undefined) {
    const n = readCategoryName(b.name);
    if (!n || n.length > 60) return c.json({ error: NAME_MSG }, 400);
    name = n;
  }
  let color = row.color as string;
  if (b.color !== undefined) {
    if (!CATEGORY_PALETTE.includes(b.color)) return c.json({ error: 'Pilih warna dari palet.' }, 400);
    color = b.color;
  }
  const active = b.is_active === undefined ? row.is_active : b.is_active ? 1 : 0;
  try {
    await c.env.DB.prepare('UPDATE event_categories SET name = ?, color = ?, is_active = ? WHERE id = ?').bind(name, color, active, row.id).run();
  } catch (e) {
    if (isUniqueError(e)) return c.json({ error: 'Nama kategori sudah dipakai.' }, 409);
    throw e;
  }
  return c.json({ id: row.id });
});
