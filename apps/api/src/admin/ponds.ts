import { Hono } from 'hono';
import type { Context } from 'hono';
import { THRESHOLD_KEYS, parseNumber, type Threshold } from '@evo/shared';
import type { AppEnv } from '../types';
import { requireAuth, requireAdmin } from '../auth/guard';

export const pondRoutes = new Hono<AppEnv>();
pondRoutes.use('*', requireAuth);

type Thresholds = Record<string, Threshold>;
type Fail = { fail: Response };
const isFail = (v: unknown): v is Fail => typeof v === 'object' && v !== null && 'fail' in v;

const DUP = 'Kode atau nama sudah dipakai.';

function readThresholds(c: Context<AppEnv>, raw: unknown): Thresholds | Fail {
  const out: Thresholds = {};
  if (raw === undefined || raw === null) return out;
  if (typeof raw !== 'object') return { fail: c.json({ error: 'Baku mutu tidak valid.' }, 400) };
  for (const [key, v] of Object.entries(raw as Record<string, any>)) {
    if (!(THRESHOLD_KEYS as readonly string[]).includes(key)) return { fail: c.json({ error: 'Baku mutu tidak dikenal.' }, 400) };
    const min = parseNumber(v?.min);
    const max = parseNumber(v?.max);
    if (min === 'invalid' || max === 'invalid') return { fail: c.json({ error: 'Batas baku mutu harus berupa angka.' }, 400) };
    if (min !== null && max !== null && min > max) return { fail: c.json({ error: 'Batas minimum tidak boleh di atas maksimum.' }, 400) };
    out[key] = { min, max };
  }
  return out;
}

function readCoord(c: Context<AppEnv>, raw: unknown, label: string, limit: number): number | null | Fail {
  const v = parseNumber(raw);
  if (v === 'invalid' || (v !== null && Math.abs(v) > limit)) return { fail: c.json({ error: `${label} harus berupa angka antara -${limit} dan ${limit}.` }, 400) };
  return v;
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

async function list(c: Context<AppEnv>, all: boolean) {
  const db = c.env.DB;
  const { results } = await db.prepare(
    `SELECT id,code,name,latitude,longitude,is_active FROM settling_ponds ${all ? '' : 'WHERE is_active = 1'} ORDER BY COALESCE(code, name), name`,
  ).all<any>();
  const th = (await db.prepare('SELECT sp_id,key,min,max FROM pond_thresholds').all<any>()).results;
  return results.map((r) => ({
    id: r.id, code: r.code, name: r.name, latitude: r.latitude, longitude: r.longitude, is_active: !!r.is_active,
    thresholds: Object.fromEntries(th.filter((t) => t.sp_id === r.id).map((t) => [t.key, { min: t.min, max: t.max }])),
  }));
}

async function saveThresholds(db: D1Database, spId: string, t: Thresholds) {
  for (const [key, v] of Object.entries(t)) {
    await db.prepare('INSERT INTO pond_thresholds (sp_id,key,min,max) VALUES (?,?,?,?) ON CONFLICT(sp_id,key) DO UPDATE SET min = excluded.min, max = excluded.max')
      .bind(spId, key, v.min, v.max).run();
  }
}

pondRoutes.get('/', async (c) => c.json(await list(c, c.req.query('all') === '1')));

pondRoutes.post('/', requireAdmin, async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  const name = text(b.name);
  if (!name) return c.json({ error: 'Nama pond wajib diisi.' }, 400);
  const lat = readCoord(c, b.latitude, 'Latitude', 90);
  if (isFail(lat)) return lat.fail;
  const lng = readCoord(c, b.longitude, 'Longitude', 180);
  if (isFail(lng)) return lng.fail;
  const th = readThresholds(c, b.thresholds);
  if (isFail(th)) return th.fail;
  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare('INSERT INTO settling_ponds (id,code,name,latitude,longitude,is_active) VALUES (?,?,?,?,?,1)')
      .bind(id, text(b.code), name, lat, lng).run();
  } catch {
    return c.json({ error: DUP }, 409);
  }
  await saveThresholds(c.env.DB, id, th);
  return c.json({ id }, 201);
});

pondRoutes.patch('/:id', requireAdmin, async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  const row = await c.env.DB.prepare('SELECT id,code,name,latitude,longitude,is_active FROM settling_ponds WHERE id = ?').bind(c.req.param('id')).first<any>();
  if (!row) return c.json({ error: 'Pond tidak ditemukan.' }, 404);
  const name = b.name === undefined ? row.name : text(b.name);
  if (!name) return c.json({ error: 'Nama pond wajib diisi.' }, 400);
  const lat = b.latitude === undefined ? row.latitude : readCoord(c, b.latitude, 'Latitude', 90);
  if (isFail(lat)) return lat.fail;
  const lng = b.longitude === undefined ? row.longitude : readCoord(c, b.longitude, 'Longitude', 180);
  if (isFail(lng)) return lng.fail;
  const th = readThresholds(c, b.thresholds);
  if (isFail(th)) return th.fail;
  if (b.is_active !== undefined && typeof b.is_active !== 'boolean') return c.json({ error: 'Status aktif tidak valid.' }, 400);
  const code = b.code === undefined ? row.code : text(b.code);
  const active = b.is_active === undefined ? row.is_active : b.is_active ? 1 : 0;
  try {
    await c.env.DB.prepare('UPDATE settling_ponds SET code = ?, name = ?, latitude = ?, longitude = ?, is_active = ? WHERE id = ?')
      .bind(code, name, lat, lng, active, row.id).run();
  } catch {
    return c.json({ error: DUP }, 409);
  }
  await saveThresholds(c.env.DB, row.id, th);
  return c.json({ id: row.id });
});
