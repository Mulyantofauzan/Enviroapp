import { dueDates, isNoFlow, isOutOfLimit, todayInSite, type ScheduleRule } from '@evo/shared';
import type { Env } from '../types';
import { eventsMessage, limitMessage, monitoringMessage } from './select';
import { sendToUsers, type Transport } from './send';

const DAY_MS = 86_400_000;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Active accounts that may enter data and do events: Operator and Admin. */
async function workerIds(env: Env): Promise<string[]> {
  const { results } = await env.DB.prepare("SELECT id FROM users WHERE is_active = 1 AND role IN ('Operator','Admin')").all<{ id: string }>();
  return results.map((r) => r.id);
}

export async function adminIds(env: Env): Promise<string[]> {
  const { results } = await env.DB.prepare("SELECT id FROM users WHERE is_active = 1 AND role = 'Admin'").all<{ id: string }>();
  return results.map((r) => r.id);
}

/** 16:00 WITA: ponds without water data today, and missing weather. */
export async function runMonitoringReminder(env: Env, now = new Date(), transport?: Transport): Promise<void> {
  const today = todayInSite(now);
  const { results: ponds } = await env.DB.prepare(
    `SELECT p.name FROM settling_ponds p WHERE p.is_active = 1
       AND NOT EXISTS (SELECT 1 FROM surface_water w WHERE w.sp_id = p.id AND w.date = ?) ORDER BY p.name`,
  ).bind(today).all<{ name: string }>();
  const weather = await env.DB.prepare('SELECT 1 x FROM weather WHERE date = ?').bind(today).first();
  const msg = monitoringMessage(ponds.map((p) => p.name), !weather);
  if (!msg) return;
  await sendToUsers(env, await workerIds(env), msg, (u) => `monitor|${today}|${u}`, transport);
}

type Sched = ScheduleRule & { id: string; title: string };

/** Morning (07:00): due tomorrow ("soon") and due today ("due"). Afternoon (16:00): due today still open ("overdue"). */
export async function runEventReminders(env: Env, when: 'morning' | 'afternoon', now = new Date(), transport?: Transport): Promise<void> {
  const today = todayInSite(now);
  const tomorrow = addDays(today, 1);
  const { results: schedules } = await env.DB.prepare('SELECT id, title, frequency, start_date, ended_on FROM event_schedules ORDER BY title').all<Sched>();
  const { results: done } = await env.DB.prepare('SELECT schedule_id FROM event_completions WHERE due_date = ?').bind(today).all<{ schedule_id: string }>();
  const doneToday = new Set(done.map((r) => r.schedule_id));
  const dueOn = (date: string) => schedules.filter((s) => dueDates(s, date, date).length === 1);
  const users = await workerIds(env);
  const send = (kind: 'soon' | 'due' | 'overdue', titles: string[]) => {
    const msg = eventsMessage(kind, titles);
    return msg ? sendToUsers(env, users, msg, (u) => `event-${kind}|${today}|${u}`, transport) : Promise.resolve(0);
  };
  const openToday = dueOn(today).filter((s) => !doneToday.has(s.id)).map((s) => s.title);
  if (when === 'morning') {
    await send('soon', dueOn(tomorrow).map((s) => s.title));
    await send('due', openToday);
  } else {
    await send('overdue', openToday);
  }
}

type Th = { min: number | null; max: number | null };

/** After a water save: tells every active Admin about pH/TSS outlet readings outside the pond's limits. No-flow days are skipped. */
export async function notifyLimitBreaches(
  env: Env, date: string, spId: string, v: { ph_outlet: number | null; tss_outlet: number | null; debit_outlet_m3s: number | null }, transport?: Transport,
): Promise<void> {
  if (isNoFlow(v.debit_outlet_m3s)) return;
  const { results } = await env.DB.prepare('SELECT key, min, max FROM pond_thresholds WHERE sp_id = ?').bind(spId).all<{ key: string } & Th>();
  const th = Object.fromEntries(results.map((r) => [r.key, { min: r.min, max: r.max }])) as Record<string, Th>;
  const out = (['ph_outlet', 'tss_outlet'] as const).filter((k) => v[k] !== null && isOutOfLimit(v[k], th[k]));
  if (out.length === 0) return;
  const pond = await env.DB.prepare('SELECT name FROM settling_ponds WHERE id = ?').bind(spId).first<{ name: string }>();
  const admins = await adminIds(env);
  for (const k of out) {
    await sendToUsers(env, admins, limitMessage(pond?.name ?? 'Pond', k, v[k]!, th[k]), (u) => `limit|${date}|${spId}|${k}|${u}`, transport);
  }
}
