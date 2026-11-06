/** Sixteen colors that stay apart on a light background; the category master picks from these only. */
export const CATEGORY_PALETTE: readonly string[] = [
  '#2E7D32', '#1565C0', '#EF6C00', '#6A1B9A', '#C62828', '#00838F', '#9E9D24', '#AD1457',
  '#4527A0', '#00695C', '#F9A825', '#37474F', '#5D4037', '#0277BD', '#7CB342', '#D84315',
];

export const NO_CATEGORY_COLOR = '#9AA39A';

/** First palette color nobody uses yet; with all taken, the least used one (first on a tie). */
export function nextPaletteColor(used: string[]): string {
  const count = new Map<string, number>();
  for (const c of used) count.set(c, (count.get(c) ?? 0) + 1);
  let best = CATEGORY_PALETTE[0];
  let bestN = Infinity;
  for (const c of CATEGORY_PALETTE) {
    const n = count.get(c) ?? 0;
    if (n < bestN) { best = c; bestN = n; }
  }
  return best;
}
