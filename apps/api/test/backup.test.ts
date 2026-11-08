import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { gunzipSync } from 'node:zlib';
import { runBackup, backupKey, pruneBackups } from '../src/backup';
import { addUser } from './helpers';

const read = async (key: string) => {
  const o = await env.BACKUP.get(key);
  return JSON.parse(gunzipSync(Buffer.from(await o!.arrayBuffer())).toString());
};

describe('nightly backup', () => {
  it('writes every table to the backup bucket as one gzip JSON file named by date', async () => {
    const u = await addUser('Manager');
    const now = new Date('2026-11-09T18:00:00Z');
    const key = await runBackup(env, now);
    expect(key).toBe('db/2026-11-09.json.gz');
    const dump = await read(key);
    expect(dump.taken_at).toBe('2026-11-09T18:00:00.000Z');
    expect(dump.tables.users.map((r: any) => r.id)).toContain(u.id);
    expect(Object.keys(dump.tables)).toEqual(expect.arrayContaining(['users', 'settling_ponds', 'weather', 'surface_water', 'coagulant', 'evidences', 'event_schedules']));
    expect(dump.tables.sessions).toBeUndefined();
    expect(dump.tables.d1_migrations).toBeUndefined();
  });
  it('pages through tables bigger than one read', async () => {
    const stmts = Array.from({ length: 2300 }, (_, i) => env.DB.prepare('INSERT INTO event_categories (id,name,color,created_at) VALUES (?,?,?,?)').bind(`c${i}`, `N${i}`, '#111111', '2026-11-09'));
    for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
    const dump = await read(await runBackup(env, new Date('2026-11-09T18:00:00Z')));
    expect(dump.tables.event_categories.length).toBe(2300);
    expect(new Set(dump.tables.event_categories.map((r: any) => r.id)).size).toBe(dump.tables.event_categories.length);
  });
  it('keeps only the newest 30 backups and never touches other keys', async () => {
    const stale = (await env.BACKUP.list()).objects.map((o) => o.key);
    if (stale.length) await env.BACKUP.delete(stale);
    for (let d = 1; d <= 35; d++) await env.BACKUP.put(backupKey(new Date(Date.UTC(2026, 9, d))), 'x');
    await env.BACKUP.put('notes.txt', 'keep');
    await pruneBackups(env, 30);
    const keys = (await env.BACKUP.list({ prefix: 'db/' })).objects.map((o) => o.key).sort();
    expect(keys).toHaveLength(30);
    expect(keys[0]).toBe('db/2026-10-06.json.gz');
    expect(await env.BACKUP.get('notes.txt')).not.toBeNull();
  });
});
