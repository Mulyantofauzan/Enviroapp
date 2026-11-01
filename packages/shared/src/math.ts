export const SECONDS_PER_DAY = 86400;
export function m3sToM3d(m3s: number): number {
  return m3s * SECONDS_PER_DAY;
}
export function defaultRemaining(prev: number | null, stockIn: number, stockOut: number): number {
  return (prev ?? 0) + stockIn - stockOut;
}
