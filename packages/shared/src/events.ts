export const EVENT_FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual'] as const;
export type EventFrequency = (typeof EVENT_FREQUENCIES)[number];

export const FREQUENCY_LABEL: Record<EventFrequency, string> = {
  Daily: 'Harian',
  Weekly: 'Mingguan',
  Monthly: 'Bulanan',
  Quarterly: '3-Bulanan',
  'Semi-Annual': '6-Bulanan',
  Annual: 'Tahunan',
};

export type ScheduleRule = { frequency: EventFrequency; start_date: string; ended_on: string | null };
export type EventStatus = 'done' | 'overdue' | 'today' | 'upcoming';

export type EventOccurrence = {
  schedule_id: string;
  title: string;
  description: string | null;
  frequency: EventFrequency;
  sp_id: string | null;
  assigned_to_name: string | null;
  due_date: string;
  status: EventStatus;
  late: boolean;
  evidence_count: number;
  completed_at: string | null;
  completed_by_name: string | null;
};

const MAX_STEPS = 20_000;
const MONTHS: Partial<Record<EventFrequency, number>> = { Monthly: 1, Quarterly: 3, 'Semi-Annual': 6, Annual: 12 };
const DAY_MS = 86_400_000;

const parse = (iso: string) => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1, d: Number(iso.slice(8, 10)) });
const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
const fromDayNumber = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** Always counted from the anchor date, so a 31st never drifts to the 28th for good. */
function addMonthsFromAnchor(anchor: string, months: number): string {
  const a = parse(anchor);
  const total = a.y * 12 + a.m + months;
  const y = Math.floor(total / 12);
  const m = total % 12;
  const d = Math.min(a.d, daysInMonth(y, m));
  return `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Ascending, inclusive. Respects start_date and ended_on. */
export function dueDates(rule: ScheduleRule, from: string, to: string): string[] {
  const lo = from > rule.start_date ? from : rule.start_date;
  const hi = rule.ended_on && rule.ended_on < to ? rule.ended_on : to;
  if (lo > hi) return [];
  const out: string[] = [];
  const stepDays = rule.frequency === 'Daily' ? 1 : rule.frequency === 'Weekly' ? 7 : 0;
  if (stepDays) {
    const startN = dayNumber(rule.start_date);
    let k = Math.max(0, Math.ceil((dayNumber(lo) - startN) / stepDays));
    for (let i = 0; i < MAX_STEPS; i++, k++) {
      const d = fromDayNumber(startN + k * stepDays);
      if (d > hi) break;
      out.push(d);
    }
    return out;
  }
  const step = MONTHS[rule.frequency]!;
  for (let k = 0, i = 0; i < MAX_STEPS; i++, k++) {
    const d = addMonthsFromAnchor(rule.start_date, k * step);
    if (d > hi) break;
    if (d >= lo) out.push(d);
  }
  return out;
}

export const isDueDate = (rule: ScheduleRule, date: string): boolean => dueDates(rule, date, date).length === 1;

/** The site runs on WITA (Asia/Makassar, UTC+8). */
export function todayInSite(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(now);
}

export function eventStatus(due: string, today: string, completedOn: string | null): EventStatus {
  if (completedOn) return 'done';
  if (due < today) return 'overdue';
  return due === today ? 'today' : 'upcoming';
}

export const isLate = (due: string, completedOn: string | null): boolean => completedOn !== null && completedOn > due;
