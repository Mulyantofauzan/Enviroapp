import type { Context } from 'hono';
import { isValidDate, parseNumber } from '@evo/shared';
import type { AppEnv } from '../types';

export type Fail = { fail: Response };
export const isFail = <T>(v: T | Fail): v is Fail => typeof v === 'object' && v !== null && 'fail' in v;

export function badDate(c: Context<AppEnv>, date: string): Response | null {
  return isValidDate(date) ? null : c.json({ error: 'Date must look like 2026-11-02.' }, 400);
}

export async function activePond(c: Context<AppEnv>, spId: string): Promise<Response | null> {
  const row = await c.env.DB.prepare('SELECT is_active FROM settling_ponds WHERE id = ?').bind(spId).first<{ is_active: number }>();
  if (!row) return c.json({ error: 'Pond not found.' }, 404);
  if (!row.is_active) return c.json({ error: 'This pond is switched off. Ask an admin to turn it on.' }, 409);
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
    if (v === 'invalid') return { fail: c.json({ error: `${labels[key]} must be a number.` }, 400) };
    const { min, max } = rules[key];
    if (v !== null && ((min !== undefined && v < min) || (max !== undefined && v > max))) {
      const range = max !== undefined ? `between ${min ?? 0} and ${max}` : `${min ?? 0} or more`;
      return { fail: c.json({ error: `${labels[key]} must be ${range}.` }, 400) };
    }
    out[key] = v;
  }
  return out;
}

export async function readBody(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  const b = await c.req.json().catch(() => ({}));
  return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
}
