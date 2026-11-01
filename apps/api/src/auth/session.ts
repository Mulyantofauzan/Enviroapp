import type { SessionUser } from '../types';

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const id = crypto.randomUUID() + crypto.randomUUID();
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  await db.prepare('INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)').bind(id, userId, expires).run();
  return id;
}

export async function getSessionUser(db: D1Database, id: string): Promise<SessionUser | null> {
  const row = await db
    .prepare('SELECT u.id, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?')
    .bind(id, Math.floor(Date.now() / 1000))
    .first<SessionUser>();
  return row ?? null;
}

export async function deleteSession(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
}
