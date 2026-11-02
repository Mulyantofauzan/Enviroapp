import { env } from 'cloudflare:workers';
import { app } from '../src/index';
import { hashPassword } from '../src/auth/password';
import type { Role } from '@evo/shared';

export async function addUser(role: Role, email = `${role.toLowerCase()}@x.id`, password = 'pw-12345') {
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO users (id,name,email,password_hash,role) VALUES (?,?,?,?,?)')
    .bind(id, `${role} User`, email, await hashPassword(password), role).run();
  return { id, email, password };
}

export function call(path: string, init: RequestInit & { cookie?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return app.request(`/api${path}`, { ...init, headers }, env);
}

export async function login(role: Role) {
  const u = await addUser(role);
  const res = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: u.email, password: u.password }) });
  const cookie = res.headers.get('set-cookie')!.split(';')[0];
  return { cookie, user: u };
}

export const json = (o: unknown) => JSON.stringify(o);

export async function addPond(name = 'SP 1', active = true) {
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO settling_ponds (id,name,is_active) VALUES (?,?,?)').bind(id, name, active ? 1 : 0).run();
  return id;
}
