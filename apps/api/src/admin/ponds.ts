import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { requireAuth, requireAdmin } from '../auth/guard';

export const pondRoutes = new Hono<AppEnv>();
pondRoutes.use('*', requireAuth);

const present = (r: any) => ({ id: r.id, name: r.name, is_active: !!r.is_active });

pondRoutes.get('/', async (c) => {
  const all = c.req.query('all') === '1';
  const sql = `SELECT id,name,is_active FROM settling_ponds ${all ? '' : 'WHERE is_active = 1'} ORDER BY name`;
  const { results } = await c.env.DB.prepare(sql).all();
  return c.json(results.map(present));
});

pondRoutes.post('/', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return c.json({ error: 'Pond name is required.' }, 400);
  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare('INSERT INTO settling_ponds (id,name,is_active) VALUES (?,?,1)').bind(id, name).run();
  } catch {
    return c.json({ error: 'A pond with this name already exists.' }, 409);
  }
  return c.json({ id, name, is_active: true }, 201);
});

pondRoutes.patch('/:id', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const row = await c.env.DB.prepare('SELECT id,name,is_active FROM settling_ponds WHERE id = ?').bind(c.req.param('id')).first<any>();
  if (!row) return c.json({ error: 'Pond not found.' }, 404);
  const name = body.name === undefined ? row.name : typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return c.json({ error: 'Pond name is required.' }, 400);
  const active = body.is_active === undefined ? row.is_active : body.is_active ? 1 : 0;
  try {
    await c.env.DB.prepare('UPDATE settling_ponds SET name = ?, is_active = ? WHERE id = ?').bind(name, active, row.id).run();
  } catch {
    return c.json({ error: 'A pond with this name already exists.' }, 409);
  }
  return c.json(present({ id: row.id, name, is_active: active }));
});
