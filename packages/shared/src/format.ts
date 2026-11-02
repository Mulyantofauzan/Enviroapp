import type { Role } from './types';

export const ROLE_LABEL: Record<Role, string> = {
  Admin: 'Admin System',
  Manager: 'Manager',
  Operator: 'Operator Lapangan',
  Auditor: 'Auditor',
};

export function formatNumber(n: number | null, maxDecimals = 3): string {
  if (n === null) return '–';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: maxDecimals }).format(n);
}

export function formatDateId(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(d);
  const p = (t: string) => parts.find((x) => x.type === t)!.value;
  const month = p('month').replace('.', '');
  return `${p('weekday')}, ${p('day')} ${month} ${p('year')}`;
}

/** Accepts "7,2" or "7.2". A thousands separator such as "1.278,7" is rejected on purpose. */
export function parseLocaleNumber(raw: string): number | null | 'invalid' {
  const t = raw.trim();
  if (t === '') return null;
  if (t.includes(',') && t.includes('.')) return 'invalid';
  const n = Number(t.replace(',', '.'));
  return /^-?\d*[.,]?\d+$|^-?\d+[.,]$/.test(t) && Number.isFinite(n) ? n : 'invalid';
}
