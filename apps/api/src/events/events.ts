import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  EVENT_FREQUENCIES, dueDates, eventStatus, isDueDate, isLate, isValidDate, todayInSite,
  type EventFrequency, type EventOccurrence, type ScheduleRule,
} from '@evo/shared';
import type { AppEnv } from '../types';
import { requireAuth } from '../auth/guard';

export const eventRoutes = new Hono<AppEnv>();
eventRoutes.use('*', requireAuth);

const DAY_MS = 86_400_000;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const MAX_RANGE_DAYS = 62;
const OVERDUE_CAP = 200;

type Sched = ScheduleRule & {
  id: string; title: string; description: string | null; category_id: string | null; category_name: string | null; category_color: string | null;
  assigned_to_name: string | null;
};
type Completion = { schedule_id: string; due_date: string; completed_at: string; completed_on: string; completed_by_name: string };

const BASE = `SELECT s.id, s.title, s.description, s.frequency, s.start_date, s.category_id, k.name AS category_name, k.color AS category_color, s.ended_on, u.name AS assigned_to_name
  FROM event_schedules s LEFT JOIN users u ON u.id = s.assigned_to LEFT JOIN event_categories k ON k.id = s.category_id`;

type Filters = { frequency: EventFrequency | null };

/** Reads and validates the optional frequency filter. Returns a 400 response when invalid. */
function readFilters(c: Context<AppEnv>): Filters | Response {
  const frequency = c.req.query('frequency') || null;
  if (frequency !== null && !(EVENT_FREQUENCIES as readonly string[]).includes(frequency)) return c.json({ error: 'Pilih frekuensi yang benar.' }, 400);
  return { frequency: frequency as EventFrequency | null };
}

async function loadSchedules(db: D1Database, f: Filters): Promise<Sched[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.frequency) { where.push('s.frequency = ?'); args.push(f.frequency); }
  const sql = `${BASE} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.title, s.start_date`;
  return (await db.prepare(sql).bind(...args).all<Sched>()).results;
}

function occurrence(s: Sched, due: string, today: string, done: Completion | undefined, evidenceCount: number): EventOccurrence {
  const completedOn = done?.completed_on ?? null;
  return {
    schedule_id: s.id, title: s.title, description: s.description, frequency: s.frequency,
    category_id: s.category_id, category_name: s.category_name, category_color: s.category_color,
    assigned_to_name: s.assigned_to_name, due_date: due, status: eventStatus(due, today, completedOn), late: isLate(due, completedOn),
    evidence_count: evidenceCount, completed_at: done?.completed_at ?? null, completed_by_name: done?.completed_by_name ?? null,
  };
}

const COMPLETIONS = `SELECT c.schedule_id, c.due_date, c.completed_at, c.completed_on, u.name AS completed_by_name
  FROM event_completions c JOIN users u ON u.id = c.completed_by`;

async function evidenceCounts(db: D1Database, from: string | null, to: string): Promise<Map<string, number>> {
  const sql = `SELECT schedule_id, due_date, COUNT(*) n FROM evidences WHERE due_date <= ? ${from ? 'AND due_date >= ?' : ''} GROUP BY schedule_id, due_date`;
  const { results } = await db.prepare(sql).bind(...(from ? [to, from] : [to])).all<any>();
  return new Map(results.map((r) => [`${r.schedule_id}|${r.due_date}`, r.n as number]));
}

/** Every due date that has no completion yet, from each schedule's start up to yesterday. Newest first. */
function overdueList(schedules: Sched[], done: Set<string>, today: string) {
  const out: { s: Sched; due: string }[] = [];
  const yesterday = addDays(today, -1);
  for (const s of schedules) {
    if (s.start_date > yesterday) continue;
    for (const due of dueDates(s, s.start_date, yesterday)) if (!done.has(`${s.id}|${due}`)) out.push({ s, due });
  }
  out.sort((a, b) => (a.due < b.due ? 1 : a.due > b.due ? -1 : a.s.title.localeCompare(b.s.title)));
  return out;
}

eventRoutes.get('/', async (c) => {
  const from = c.req.query('from') ?? '';
  const to = c.req.query('to') ?? '';
  if (!isValidDate(from) || !isValidDate(to) || from > to) return c.json({ error: 'Pilih rentang tanggal yang benar.' }, 400);
  if ((Date.parse(to) - Date.parse(from)) / DAY_MS > MAX_RANGE_DAYS) return c.json({ error: 'Pilih rentang 62 hari atau kurang.' }, 400);
  const f = readFilters(c);
  if (f instanceof Response) return f;
  const db = c.env.DB;
  const today = todayInSite();
  const schedules = await loadSchedules(db, f);
  const done = new Map((await db.prepare(`${COMPLETIONS} WHERE c.due_date BETWEEN ? AND ?`).bind(from, to).all<Completion>()).results
    .map((r) => [`${r.schedule_id}|${r.due_date}`, r]));
  const counts = await evidenceCounts(db, from, to);
  const events: EventOccurrence[] = [];
  for (const s of schedules) {
    for (const due of dueDates(s, from, to)) {
      const k = `${s.id}|${due}`;
      events.push(occurrence(s, due, today, done.get(k), counts.get(k) ?? 0));
    }
  }
  events.sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : a.title.localeCompare(b.title)));
  return c.json({ today, events });
});

eventRoutes.get('/overdue', async (c) => {
  const f = readFilters(c);
  if (f instanceof Response) return f;
  const db = c.env.DB;
  const today = todayInSite();
  const schedules = await loadSchedules(db, f);
  const doneAll = (await db.prepare('SELECT schedule_id, due_date FROM event_completions WHERE due_date < ?').bind(today).all<{ schedule_id: string; due_date: string }>()).results;
  const done = new Set(doneAll.map((r) => `${r.schedule_id}|${r.due_date}`));
  const list = overdueList(schedules, done, today);
  const shown = list.slice(0, OVERDUE_CAP);
  const counts = await evidenceCounts(db, null, addDays(today, -1));
  return c.json({ today, total: list.length, events: shown.map(({ s, due }) => occurrence(s, due, today, undefined, counts.get(`${s.id}|${due}`) ?? 0)) });
});

eventRoutes.get('/summary', async (c) => {
  const db = c.env.DB;
  const today = todayInSite();
  const schedules = await loadSchedules(db, { frequency: null });
  // Completions only exist on real due dates (timing is locked once records exist), so
  // overdue = due dates up to yesterday minus completions up to yesterday. No rows are read back.
  const yesterday = addDays(today, -1);
  let due = 0;
  for (const s of schedules) if (s.start_date <= yesterday) due += dueDates(s, s.start_date, yesterday).length;
  const past = await db.prepare('SELECT COUNT(*) n FROM event_completions WHERE due_date < ?').bind(today).first<{ n: number }>();
  const doneToday = new Set((await db.prepare('SELECT schedule_id FROM event_completions WHERE due_date = ?').bind(today).all<{ schedule_id: string }>()).results.map((r) => r.schedule_id));
  const dueToday = schedules.filter((s) => isDueDate(s, today) && !doneToday.has(s.id)).length;
  return c.json({ today, overdue: Math.max(0, due - (past?.n ?? 0)), due_today: dueToday });
});

eventRoutes.get('/:scheduleId/:date', async (c) => {
  const date = c.req.param('date');
  if (!isValidDate(date)) return c.json({ error: 'Tanggal harus berbentuk 2026-11-02.' }, 400);
  const db = c.env.DB;
  const s = await db.prepare(`${BASE} WHERE s.id = ?`).bind(c.req.param('scheduleId')).first<Sched>();
  if (!s || !isDueDate(s, date)) return c.json({ error: 'Event tidak ditemukan.' }, 404);
  const today = todayInSite();
  const done = await db.prepare(`${COMPLETIONS} WHERE c.schedule_id = ? AND c.due_date = ?`).bind(s.id, date).first<Completion>();
  const evidences = (await db.prepare(
    `SELECT e.id, e.filename, e.mime, e.size, e.uploaded_at, u.name AS uploaded_by_name, e.uploaded_by, e.source, e.gps_lat, e.gps_lng, e.gps_accuracy, e.taken_at
     FROM evidences e JOIN users u ON u.id = e.uploaded_by WHERE e.schedule_id = ? AND e.due_date = ? ORDER BY e.uploaded_at`,
  ).bind(s.id, date).all<any>()).results;
  return c.json({ today, event: occurrence(s, date, today, done ?? undefined, evidences.length), evidences });
});
