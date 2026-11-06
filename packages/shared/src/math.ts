export const SECONDS_PER_DAY = 86400;
export function m3sToM3d(m3s: number): number {
  return m3s * SECONDS_PER_DAY;
}
export function defaultRemaining(prev: number | null, stockIn: number, stockOut: number): number {
  return (prev ?? 0) + stockIn - stockOut;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
export const m3sToLs = (m3s: number): number => round6(m3s * 1000);
export const lsToM3s = (ls: number): number => round6(ls / 1000);

/** A day with no water leaving the pond: outlet flow recorded as exactly 0. */
export const isNoFlow = (debitOutlet: number | null | undefined): boolean => debitOutlet === 0;
