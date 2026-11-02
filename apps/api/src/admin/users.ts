import { Hono } from 'hono';
import { ROLES, type Role } from '@evo/shared';
import type { AppEnv } from '../types';
import { requireAuth, requireAdmin } from '../auth/guard';
import { hashPassword } from '../auth/password';

export const userRoutes = new Hono<AppEnv>();
userRoutes.use('*', requireAuth, requireAdmin);

const isRole = (r: unknown): r is Role => typeof r === 'string' && (ROLES as string[]).includes(r);
const MIN_PW = 8;

userRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id,name,email,role,is_active FROM users ORDER BY name').all();
  return c.json(results.map((u: any) => ({ ...u, is_active: !!u.is_active })));
});

userRoutes.post('/', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!name || !email.includes('@')) return c.json({ error: 'Name and a valid email are required.' }, 400);
  if (!isRole(b.role)) return c.json({ error: 'Pick a valid role.' }, 400);
  if (typeof b.password !== 'string' || b.password.length < MIN_PW) return c.json({ error: `Password needs at least ${MIN_PW} characters.` }, 400);
  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare('INSERT INTO users (id,name,email,password_hash,role) VALUES (?,?,?,?,?)')
      .bind(id, name, email, await hashPassword(b.password), b.role).run();
  } catch {
    return c.json({ error: 'This email is already in use.' }, 409);
  }
  return c.json({ id, name, email, role: b.role }, 201);
});

userRoutes.patch('/:id', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const row = await c.env.DB.prepare('SELECT id,name,email,role,is_active FROM users WHERE id = ?').bind(c.req.param('id')).first<any>();
  if (!row) return c.json({ error: 'User not found.' }, 404);
  const name = b.name === undefined ? row.name : typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) return c.json({ error: 'Name is required.' }, 400);
  if (b.role !== undefined && !isRole(b.role)) return c.json({ error: 'Pick a valid role.' }, 400);
  const role = b.role ?? row.role;
  if (b.password !== undefined) {
    if (typeof b.password !== 'string' || b.password.length < MIN_PW) return c.json({ error: `Password needs at least ${MIN_PW} characters.` }, 400);
    await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(b.password), row.id).run();
    await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.id).run();
  }
  if (b.is_active !== undefined && typeof b.is_active !== 'boolean') return c.json({ error: 'Status aktif tidak valid.' }, 400);
  const active = b.is_active === undefined ? !!row.is_active : b.is_active;
  if (!active && c.get('user').id === row.id) return c.json({ error: 'Anda tidak bisa menonaktifkan akun sendiri.' }, 409);
  const losesAdmin = row.role === 'Admin' && row.is_active && (role !== 'Admin' || !active);
  if (losesAdmin) {
    const n = await c.env.DB.prepare("SELECT COUNT(*) c FROM users WHERE role = 'Admin' AND is_active = 1").first<{ c: number }>();
    if ((n?.c ?? 0) <= 1) return c.json({ error: 'Harus ada minimal satu admin aktif.' }, 409);
  }
  await c.env.DB.prepare('UPDATE users SET name = ?, role = ?, is_active = ? WHERE id = ?').bind(name, role, active ? 1 : 0, row.id).run();
  if (!active) await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.id).run();
  return c.json({ id: row.id, name, email: row.email, role, is_active: active });
});
