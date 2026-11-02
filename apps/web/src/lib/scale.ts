/** 1, 2, 2.5, 5 times a power of ten, giving about `steps` axis steps. */
export function niceStep(range: number, steps = 4): number {
  const rough = range / steps || 1;
  const p = Math.pow(10, Math.floor(Math.log10(rough)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= rough - 1e-9) return m * p;
  return 10 * p;
}
export const clean = (n: number) => Math.round(n * 1e6) / 1e6;
