const WINANSI_EXTRA = new Set(['–', '—', '‘', '’', '“', '”', '•', '…', '€', '™']);

/** The built-in PDF font draws Latin text only: anything else becomes "?" and control characters go. */
export function pdfSafe(s: string): string {
  return Array.from(s).map((ch) => {
    const cp = ch.codePointAt(0)!;
    if (cp === 9) return ' ';
    if (cp < 32 || (cp >= 127 && cp < 160)) return '';
    return cp <= 0xff || WINANSI_EXTRA.has(ch) ? ch : '?';
  }).join('');
}
