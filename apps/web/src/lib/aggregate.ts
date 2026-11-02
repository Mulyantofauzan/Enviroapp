import { addDays, addMonths, dayMonth, mondayOf, monthRange } from './dates';

export type DayValue = { date: string; value: number | null };
export type Bucket = { key: string; label: string; value: number | null; partial: boolean };

type Mode = 'mean' | 'sum';

const monthLabel = (month: string) => {
  const m = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', month: 'short' }).format(new Date(`${month}-01T00:00:00Z`)).replace('.', '');
  return `${m} ${month.slice(2, 4)}`;
};

function reduce(values: number[], mode: Mode): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((a, b) => a + b, 0);
  return mode === 'sum' ? total : total / values.length;
}

/** Days after `today` never count, and a day without a value is skipped, not read as zero. */
function collect(days: DayValue[], today: string, from: string, to: string): number[] {
  return days.filter((d) => d.value !== null && d.date >= from && d.date <= to && d.date <= today).map((d) => d.value as number);
}

function byWeek(days: DayValue[], today: string, n: number, mode: Mode): Bucket[] {
  const thisMonday = mondayOf(today);
  const out: Bucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(thisMonday, -7 * i);
    const end = addDays(start, 6);
    out.push({ key: start, label: dayMonth(start), value: reduce(collect(days, today, start, end), mode), partial: today >= start && today < end });
  }
  return out;
}

function byMonth(days: DayValue[], today: string, n: number, mode: Mode): Bucket[] {
  const thisMonth = today.slice(0, 7);
  const out: Bucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const month = addMonths(thisMonth, -i);
    const [first, last] = monthRange(month);
    out.push({ key: month, label: monthLabel(month), value: reduce(collect(days, today, first, last), mode), partial: month === thisMonth && today < last });
  }
  return out;
}

export const meanByWeek = (days: DayValue[], today: string, n = 5) => byWeek(days, today, n, 'mean');
export const sumByWeek = (days: DayValue[], today: string, n = 5) => byWeek(days, today, n, 'sum');
export const meanByMonth = (days: DayValue[], today: string, n = 12) => byMonth(days, today, n, 'mean');
export const sumByMonth = (days: DayValue[], today: string, n = 12) => byMonth(days, today, n, 'sum');
