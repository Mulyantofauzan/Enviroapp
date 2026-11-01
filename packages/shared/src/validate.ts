import type { Role } from './types';

export function parseNumber(raw: unknown): number | null | 'invalid' {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 'invalid';
  }
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 'invalid';
  return 'invalid';
}

export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const canWrite = (role: Role): boolean => role === 'Operator' || role === 'Admin';
export const isAdmin = (role: Role): boolean => role === 'Admin';
