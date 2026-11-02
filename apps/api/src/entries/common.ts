import type { Context } from 'hono';
import { isValidDate, parseNumber } from '@evo/shared';
import type { AppEnv } from '../types';

export type Fail = { fail: Response };
export const isFail = <T>(v: T | Fail): v is Fail => typeof v === 'object' && v !== null && 'fail' in v;

export function badDate(c: Context<AppEnv>, date: string): Response | null {
  return isValidDate(date) ? null : c.json({ error: 'Tanggal harus berbentuk 2026-11-02.' }, 400);
}

export async function activePond(c: Context<AppEnv>, spId: string): Promise<Response | null> {
  const row = await c.env.DB.prepare('SELECT is_active FROM settling_ponds WHERE id = ?').bind(spId).first<{ is_active: number }>();
  if (!row) return c.json({ error: 'Pond tidak ditemukan.' }, 404);
  if (!row.is_active) return c.json({ error: 'Settling pond ini nonaktif. Minta admin mengaktifkannya.' }, 409);
  return null;
}

type Rule = { min?: number; max?: number };

/** Read named numeric fields from a body. Blank -> null. Text or out-of-range -> a 400 response. */
export function readNumbers<K extends string>(
  c: Context<AppEnv>,
  body: Record<string, unknown>,
  rules: Record<K, Rule>,
  labels: Record<K, string>,
): Record<K, number | null> | Fail {
  const out = {} as Record<K, number | null>;
  for (const key of Object.keys(rules) as K[]) {
    const v = parseNumber(body[key]);
    if (v === 'invalid') return { fail: c.json({ error: `${labels[key]} harus berupa angka.` }, 400) };
    const { min, max } = rules[key];
    if (v !== null && ((min !== undefined && v < min) || (max !== undefined && v > max))) {
      const range = max !== undefined ? `antara ${min ?? 0} dan ${max}` : `${min ?? 0} atau lebih`;
      return { fail: c.json({ error: `${labels[key]} harus ${range}.` }, 400) };
    }
    out[key] = v;
  }
  return out;
}

export async function readBody(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  const b = await c.req.json().catch(() => ({}));
  return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
}
