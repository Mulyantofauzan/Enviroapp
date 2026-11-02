import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { addPond, call, login } from './helpers';

type Row = { date: string; type: string; out: number | null };

async function seed(sp: string, userId: string, rows: Row[]) {
  for (const r of rows)
    await env.DB.prepare('INSERT INTO coagulant (id,date,sp_id,type,stock_in,stock_out,stock_remaining,logged_by) VALUES (?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), r.date, sp, r.type, 0, r.out, 0, userId).run();
}

const get = (cookie: string, q: string) => call(`/history/coagulant-total${q}`, { cookie });

describe('GET /history/coagulant-total', () => {
  it('sums stock_out per pond and type up to `to`, ignoring later rows', async () => {
    const { cookie, user } = await login('Manager');
    const sp = await addPond('SP A');
    await seed(sp, user.id, [
      { date: '2026-01-05', type: 'Tawas Serbuk', out: 100 },
      { date: '2026-02-05', type: 'Tawas Serbuk', out: 50.5 },
      { date: '2026-02-05', type: 'Tawas Batu', out: 25 },
      { date: '2026-03-01', type: 'Tawas Serbuk', out: 999 },
    ]);
    const res = await get(cookie, '?to=2026-02-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ponds).toEqual([{ sp_id: sp, first_date: '2026-01-05', 'Tawas Serbuk': 150.5, 'Tawas Batu': 25, Kapur: 0 }]);
  });

  it('counts null stock_out as 0 and missing types as 0', async () => {
    const { cookie, user } = await login('Manager');
    const sp = await addPond('SP B');
    await seed(sp, user.id, [{ date: '2026-02-01', type: 'Kapur', out: null }]);
    const body = (await (await get(cookie, '?to=2026-02-28')).json()) as any;
    expect(body.ponds).toEqual([{ sp_id: sp, first_date: '2026-02-01', 'Tawas Serbuk': 0, 'Tawas Batu': 0, Kapur: 0 }]);
  });

  it('returns one entry per pond, or only the requested one with sp=', async () => {
    const { cookie, user } = await login('Manager');
    const a = await addPond('SP C'), b = await addPond('SP D');
    await seed(a, user.id, [{ date: '2026-02-01', type: 'Tawas Batu', out: 10 }]);
    await seed(b, user.id, [{ date: '2026-01-15', type: 'Tawas Batu', out: 20 }]);
    const all = (await (await get(cookie, '?to=2026-02-28')).json()) as any;
    expect(all.ponds.map((p: any) => p.sp_id).sort()).toEqual([a, b].sort());
    expect(all.ponds.find((p: any) => p.sp_id === b).first_date).toBe('2026-01-15');
    const one = (await (await get(cookie, `?to=2026-02-28&sp=${a}`)).json()) as any;
    expect(one.ponds).toHaveLength(1);
    expect(one.ponds[0].sp_id).toBe(a);
  });

  it('omits ponds with no rows', async () => {
    const { cookie } = await login('Manager');
    await addPond('SP E');
    expect(((await (await get(cookie, '?to=2026-02-28')).json()) as any).ponds).toEqual([]);
  });

  it('rejects bad or far-future dates with 400', async () => {
    const { cookie } = await login('Manager');
    for (const q of ['?to=2026-13-40', '?to=', '', '?to=2099-01-01']) {
      const res = await get(cookie, q);
      expect(res.status, q).toBe(400);
      expect(((await res.json()) as any).error).toBe('Tanggal akhir tidak sah.');
    }
  });

  it('401 without a session', async () => {
    expect((await call('/history/coagulant-total?to=2026-02-28')).status).toBe(401);
  });

  it.each(['Auditor', 'Manager', 'Operator', 'Admin'] as const)('%s may read', async (role) => {
    const { cookie } = await login(role);
    expect((await get(cookie, '?to=2026-02-28')).status).toBe(200);
  });
});
