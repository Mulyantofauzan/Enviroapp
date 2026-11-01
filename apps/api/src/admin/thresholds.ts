import { Hono } from 'hono';
import { THRESHOLD_KEYS, parseNumber, type Threshold } from '@evo/shared';
import type { AppEnv } from '../types';
import { requireAuth, requireAdmin } from '../auth/guard';

export const thresholdRoutes = new Hono<AppEnv>();
thresholdRoutes.use('*', requireAuth);

thresholdRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT key,min,max FROM thresholds').all<{ key: string; min: number | null; max: number | null }>();
  const out: Record<string, Threshold> = {};
  for (const r of results) out[r.key] = { min: r.min, max: r.max };
  return c.json(out);
});

thresholdRoutes.put('/:key', requireAdmin, async (c) => {
  const key = c.req.param('key');
  if (!(THRESHOLD_KEYS as readonly string[]).includes(key)) return c.json({ error: 'Unknown limit.' }, 400);
  const body = await c.req.json().catch(() => ({}));
  const min = parseNumber(body.min);
  const max = parseNumber(body.max);
  if (min === 'invalid' || max === 'invalid') return c.json({ error: 'Limits must be numbers.' }, 400);
  if (min !== null && max !== null && min > max) return c.json({ error: 'Minimum must not be above maximum.' }, 400);
  await c.env.DB.prepare('INSERT INTO thresholds (key,min,max) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET min = excluded.min, max = excluded.max')
    .bind(key, min, max).run();
  return c.json({ min, max });
});
