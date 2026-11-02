import { addDays, addMonths, mondayOf } from '../dates';

export const KG_PER_BAG = 25;
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO-8601 week number: the week belongs to the year of its Thursday. */
export function isoWeek(date: string): number {
  const thursday = addDays(mondayOf(date), 3);
  const jan1 = `${thursday.slice(0, 4)}-01-01`;
  const days = (Date.parse(`${thursday}T00:00:00Z`) - Date.parse(`${jan1}T00:00:00Z`)) / 86_400_000;
  return Math.floor(days / 7) + 1;
}

export const monthShortEn = (month: string) => MONTHS_EN[Number(month.slice(5, 7)) - 1];
export const dayLabel = (date: string) => `${date.slice(8, 10)}-${monthShortEn(date.slice(0, 7))}`;

export function lastDays(to: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(to, i - (n - 1)));
}

export function lastWeeks(to: string, n: number): { monday: string; label: string; days: number }[] {
  const end = mondayOf(to);
  const elapsed = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${end}T00:00:00Z`)) / 86_400_000 + 1;
  return Array.from({ length: n }, (_, i) => {
    const monday = addDays(end, (i - (n - 1)) * 7);
    return { monday, label: `W${isoWeek(monday)}`, days: i === n - 1 ? elapsed : 7 };
  });
}

export function lastMonths(to: string, n: number): { month: string; label: string }[] {
  const end = to.slice(0, 7);
  return Array.from({ length: n }, (_, i) => {
    const month = addMonths(end, i - (n - 1));
    return { month, label: monthShortEn(month) };
  });
}

export const bags = (kg: number) => Math.round((kg / KG_PER_BAG) * 10) / 10;
