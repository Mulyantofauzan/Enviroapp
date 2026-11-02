import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { AppEnv } from '../types';
import { hashPassword, verifyPassword } from './password';
import { createSession, deleteSession, SESSION_TTL_SECONDS } from './session';
import { COOKIE, requireAuth } from './guard';

// Verified against when the email is unknown, so known and unknown emails take the same time.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword('not-a-real-password'));

export const authRoutes = new Hono<AppEnv>();

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const row = await c.env.DB.prepare('SELECT id, name, role, password_hash, is_active FROM users WHERE lower(email) = ?')
    .bind(email).first<{ id: string; name: string; role: string; password_hash: string; is_active: number }>();
  const ok = await verifyPassword(password, row?.password_hash ?? (await getDummyHash()));
  if (!row || !ok) return c.json({ error: 'Email atau kata sandi salah.' }, 401);
  if (!row.is_active) return c.json({ error: 'Akun nonaktif. Hubungi admin.' }, 401);
  const sid = await createSession(c.env.DB, row.id);
  const secure = new URL(c.req.url).protocol === 'https:';
  setCookie(c, COOKIE, sid, { httpOnly: true, sameSite: 'Lax', path: '/', secure, maxAge: SESSION_TTL_SECONDS });
  return c.json({ id: row.id, name: row.name, role: row.role });
});

authRoutes.post('/logout', async (c) => {
  const sid = getCookie(c, COOKIE);
  if (sid) await deleteSession(c.env.DB, sid);
  deleteCookie(c, COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/me', requireAuth, (c) => c.json(c.get('user')));
