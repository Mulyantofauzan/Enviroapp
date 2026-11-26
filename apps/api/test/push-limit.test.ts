import { describe, it, expect, afterEach } from 'vitest';
import { env } from 'cloudflare:workers';
import { addPond, call, json, login, addUser } from './helpers';
import { resetTransport, setTransport } from '../src/push/send';
import type { Msg } from '../src/push/select';

afterEach(resetTransport);
const sent: { user: string; msg: Msg }[] = [];
async function admin() {
  const a = await addUser('Admin', `a${Math.random()}@x.id`);
  await env.DB.prepare('INSERT INTO push_subscriptions (id,user_id,endpoint,p256dh,auth,created_at) VALUES (?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), a.id, `https://p/${a.id}`, 'k', 'a', '2026-11-23').run();
  return a;
}
async function setup() {
  sent.length = 0;
  setTransport(async (s, msg) => { sent.push({ user: s.endpoint.split('/').pop()!, msg }); return 201; });
  const sp = await addPond('SP 11 LGG');
  await env.DB.prepare('INSERT INTO pond_thresholds (sp_id,key,min,max) VALUES (?,?,?,?)').bind(sp, 'tss_outlet', null, 40).run();
  await env.DB.prepare('INSERT INTO pond_thresholds (sp_id,key,min,max) VALUES (?,?,?,?)').bind(sp, 'ph_outlet', 6, 9).run();
  return { sp, adm: await admin(), op: await login('Operator') };
}
const save = (sp: string, cookie: string, v: Record<string, number>, date = '2026-11-20') =>
  call(`/water/${date}/${sp}`, { method: 'PUT', cookie, body: json({ ph_inlet: 7, tss_inlet: 30, debit_inlet_m3s: 1, debit_outlet_m3s: 1, ph_outlet: 7, tss_outlet: 10, ...v }) });

describe('out-of-limit push on water save', () => {
  it('tells the Admin once when TSS outlet is above the limit', async () => {
    const { sp, adm, op } = await setup();
    expect((await save(sp, op.cookie, { tss_outlet: 52 })).status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].user).toBe(adm.id);
    expect(sent[0].msg.body).toBe('SP 11 LGG: TSS outlet 52 mg/L di atas baku mutu (maks. 40).');
  });
  it('does not repeat when the same breach is saved again', async () => {
    const { sp, op } = await setup();
    await save(sp, op.cookie, { tss_outlet: 52 });
    await save(sp, op.cookie, { tss_outlet: 55 });
    expect(sent).toHaveLength(1);
  });
  it('stays quiet inside the limits and on no-flow days', async () => {
    const { sp, op } = await setup();
    await save(sp, op.cookie, { tss_outlet: 30 }, '2026-11-20');
    await save(sp, op.cookie, { tss_outlet: 99, debit_outlet_m3s: 0 }, '2026-11-21');
    expect(sent).toHaveLength(0);
  });
  it('still saves when sending fails', async () => {
    const { sp, op } = await setup();
    setTransport(async () => { throw new Error('boom'); });
    expect((await save(sp, op.cookie, { tss_outlet: 52 })).status).toBe(200);
  });
});
