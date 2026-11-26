import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { addPond, addUser } from './helpers';
import { runEventReminders, runMonitoringReminder } from '../src/push/jobs';
import type { Transport } from '../src/push/send';
import type { Msg } from '../src/push/select';

// 2026-11-23 16:00 WITA = 08:00 UTC; 07:00 WITA = 2026-11-22 23:00 UTC.
const AFTERNOON = new Date('2026-11-23T08:00:00Z');
const MORNING = new Date('2026-11-22T23:00:00Z');
const TODAY = '2026-11-23';

async function person(role: 'Operator' | 'Admin' | 'Manager' | 'Auditor', active = true) {
  const u = await addUser(role, `${role}${Math.random()}@x.id`);
  if (!active) await env.DB.prepare('UPDATE users SET is_active = 0 WHERE id = ?').bind(u.id).run();
  await env.DB.prepare('INSERT INTO push_subscriptions (id,user_id,endpoint,p256dh,auth,created_at) VALUES (?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), u.id, `https://p/${u.id}`, 'k', 'a', TODAY).run();
  return u;
}
const spy = () => {
  const got: { user: string; msg: Msg }[] = [];
  const t: Transport = async (s, msg) => { got.push({ user: s.endpoint.split('/').pop()!, msg }); return 201; };
  return { got, t };
};
async function schedule(title: string, frequency: string, start: string, by: string) {
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO event_schedules (id,title,frequency,start_date,created_by,created_at) VALUES (?,?,?,?,?,?)').bind(id, title, frequency, start, by, TODAY).run();
  return id;
}

describe('runMonitoringReminder', () => {
  it('reminds Operator and Admin only, listing the missing pond and weather', async () => {
    const op = await person('Operator'); const ad = await person('Admin');
    await person('Manager'); await person('Auditor'); await person('Operator', false);
    await addPond('SP 11 LGG'); await addPond('SP lama', false);
    const s = spy();
    await runMonitoringReminder(env, AFTERNOON, s.t);
    expect(s.got.map((g) => g.user).sort()).toEqual([op.id, ad.id].sort());
    expect(s.got[0].msg.body).toBe('Belum diisi hari ini: SP 11 LGG (air), cuaca.');
  });
  it('stays quiet when water and weather are filled', async () => {
    const op = await person('Operator');
    const sp = await addPond('SP 1');
    await env.DB.prepare('INSERT INTO surface_water (id,date,sp_id,logged_by) VALUES (?,?,?,?)').bind('w', TODAY, sp, op.id).run();
    await env.DB.prepare('INSERT INTO weather (id,date,logged_by) VALUES (?,?,?)').bind('x', TODAY, op.id).run();
    const s = spy();
    await runMonitoringReminder(env, AFTERNOON, s.t);
    expect(s.got).toHaveLength(0);
  });
  it('does not notify twice when the cron runs twice', async () => {
    await person('Operator'); await addPond('SP 1');
    const s = spy();
    await runMonitoringReminder(env, AFTERNOON, s.t);
    await runMonitoringReminder(env, AFTERNOON, s.t);
    expect(s.got).toHaveLength(1);
  });
});

describe('runEventReminders', () => {
  it('morning: tells about events due tomorrow and due today', async () => {
    const op = await person('Operator'); const adm = await person('Admin');
    await schedule('Cek pompa', 'Weekly', '2026-11-24', adm.id);   // due tomorrow
    await schedule('Ukur debit', 'Daily', '2026-11-01', adm.id);   // due today and tomorrow
    const s = spy();
    await runEventReminders(env, 'morning', MORNING, s.t);
    const tags = s.got.filter((g) => g.user === op.id).map((g) => g.msg.tag).sort();
    expect(tags).toEqual(['event-due', 'event-soon']);
  });
  it('afternoon: an open event due today gets the overdue warning, a finished one does not', async () => {
    const op = await person('Operator');
    const open = await schedule('Belum selesai', 'Daily', '2026-11-01', op.id);
    const fin = await schedule('Sudah selesai', 'Daily', '2026-11-01', op.id);
    await env.DB.prepare('INSERT INTO event_completions (schedule_id,due_date,completed_by,completed_at,completed_on) VALUES (?,?,?,?,?)').bind(fin, TODAY, op.id, TODAY, TODAY).run();
    const s = spy();
    await runEventReminders(env, 'afternoon', AFTERNOON, s.t);
    expect(s.got).toHaveLength(1);
    expect(s.got[0].msg.tag).toBe('event-overdue');
    expect(s.got[0].msg.body).toBe('Belum selesai.');
    void open;
  });
  it('does not repeat when the cron runs twice, and skips Manager', async () => {
    await person('Manager'); const op = await person('Operator');
    await schedule('Harian', 'Daily', '2026-11-01', op.id);
    const s = spy();
    await runEventReminders(env, 'afternoon', AFTERNOON, s.t);
    await runEventReminders(env, 'afternoon', AFTERNOON, s.t);
    expect(s.got).toHaveLength(1);
  });
});
