import type { Env } from './types';

const PAGE = 1000;
const SKIP = new Set(['sessions', 'd1_migrations']);

export const backupKey = (d: Date) => `db/${d.toISOString().slice(0, 10)}.json.gz`;

async function gzip(text: string): Promise<ArrayBuffer> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

export async function runBackup(env: Env, now = new Date()): Promise<string> {
  const { results: names } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
  ).all<{ name: string }>();
  const tables: Record<string, unknown[]> = {};
  for (const { name } of names) {
    if (SKIP.has(name)) continue;
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { results } = await env.DB.prepare(`SELECT * FROM "${name}" ORDER BY rowid LIMIT ? OFFSET ?`).bind(PAGE, offset).all();
      rows.push(...results);
      if (results.length < PAGE) break;
    }
    tables[name] = rows;
  }
  const key = backupKey(now);
  await env.BACKUP.put(key, await gzip(JSON.stringify({ taken_at: now.toISOString(), tables })), {
    httpMetadata: { contentType: 'application/gzip' },
  });
  return key;
}

export async function pruneBackups(env: Env, keep = 30): Promise<void> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.BACKUP.list({ prefix: 'db/', cursor });
    keys.push(...page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  keys.sort();
  const old = keys.slice(0, Math.max(0, keys.length - keep));
  for (let i = 0; i < old.length; i += 1000) await env.BACKUP.delete(old.slice(i, i + 1000));
}

export async function nightlyBackup(env: Env, now = new Date()): Promise<void> {
  await runBackup(env, now);
  await pruneBackups(env, 30);
}
