const DAY_MS = 86_400_000;

export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** The Monday of the week that contains `iso`. */
export function mondayOf(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((dow + 6) % 7));
}

/** "2 Nov" */
export const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00Z`)).replace('.', '');

export const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));

/** "2026-11" -> first and last day of that month. */
export function monthRange(month: string): [string, string] {
  const first = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  return [first, addDays(`${y + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-01`, -1)];
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

/** "2 Nov 2026" */
export const dateText = (iso: string) => `${dayMonth(iso)} ${iso.slice(0, 4)}`;
