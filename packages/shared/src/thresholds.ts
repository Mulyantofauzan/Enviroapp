import type { Threshold } from './types';
export function isOutOfLimit(value: number | null, t: Threshold | undefined): boolean {
  if (value === null || !t) return false;
  if (t.min !== null && value < t.min) return true;
  if (t.max !== null && value > t.max) return true;
  return false;
}
