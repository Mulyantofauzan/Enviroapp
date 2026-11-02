/** Which points get a number on a chart: all of them when few, otherwise first, last, highest, lowest. */
export function labeledIndexes(values: (number | null)[], max = 14): Set<number> {
  const idx = values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
  if (idx.length <= max) return new Set(idx);
  const first = idx[0], last = idx[idx.length - 1];
  let hi = first, lo = first;
  for (const i of idx) {
    if ((values[i] as number) > (values[hi] as number)) hi = i;
    if ((values[i] as number) < (values[lo] as number)) lo = i;
  }
  return new Set([first, last, hi, lo]);
}

/** Text anchor that keeps a label of about `textWidth` px inside [left, right]. */
export function labelAnchor(x: number, left: number, right: number, textWidth: number): 'start' | 'middle' | 'end' {
  if (x - textWidth / 2 < left) return 'start';
  if (x + textWidth / 2 > right) return 'end';
  return 'middle';
}
