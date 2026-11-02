import { describe, it, expect } from 'vitest';
import { unzlibSync, strFromU8 } from 'fflate';
import { buildPdf, pdfSafe, type PdfChart } from './pdf';
import type { ReportSection } from './report';
import type { ReportMeta } from './xlsx';

const meta: ReportMeta = { title: 'Laporan EVO', lokasi: 'SP-02 Pit Selatan', periode: '1 Okt 2026 - 2 Nov 2026', dibuatOleh: 'Budi', dibuatPada: '2 Nov 2026 08:21 WITA' };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const section = (n: number, title = 'Air Permukaan', id: ReportSection['id'] = 'air'): ReportSection => ({
  id, title,
  columns: [{ key: 'date', header: 'Tanggal', kind: 'text' }, { key: 'pho', header: 'pH outlet', kind: 'number', decimals: 2 }],
  rows: Array.from({ length: n }, (_, i) => ({ cells: { date: `Cek pompa ${i}`, pho: i === 0 ? 5.8 : 7 }, bad: i === 0 ? ['pho'] : [] })),
});
const bytesOf = (b: Blob) => new Promise<Uint8Array>((res) => { const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result as ArrayBuffer)); r.readAsArrayBuffer(b); });
const latin = (u: Uint8Array) => Array.from(u, (c) => String.fromCharCode(c)).join('');
const pages = (u: Uint8Array) => (latin(u).match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
function allText(u: Uint8Array): string {
  const raw = latin(u);
  let out = raw;
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try { out += strFromU8(unzlibSync(Uint8Array.from(m[1], (c) => c.charCodeAt(0)))); } catch { /* not compressed text */ }
  }
  return out;
}

describe('buildPdf', () => {
  it('is a PDF blob', async () => {
    const u = await bytesOf(await buildPdf(meta, [section(3)], []));
    expect(latin(u.slice(0, 5))).toBe('%PDF-');
    expect(u.length).toBeGreaterThan(500);
  });
  it('many rows take more pages than a few, and the header row repeats', async () => {
    const few = pages(await bytesOf(await buildPdf(meta, [section(5)], [])));
    const many = pages(await bytesOf(await buildPdf(meta, [section(200)], [])));
    expect(many).toBeGreaterThan(few);
  });
  it('the title, summary and cell text can be found in the file', async () => {
    const t = allText(await bytesOf(await buildPdf(meta, [section(3)], [])));
    for (const s of ['Laporan EVO', 'SP-02 Pit Selatan', 'Cek pompa 1', 'Air Permukaan']) expect(t).toContain(s);
  });
  it('page numbers are written as "Halaman x dari y"', async () => {
    const t = allText(await bytesOf(await buildPdf(meta, [section(200)], [])));
    expect(t).toMatch(/Halaman 1 dari \d+/);
  });
  it('a character Helvetica cannot draw becomes ? instead of breaking the file', async () => {
    const odd: ReportSection = { ...section(1), rows: [{ cells: { date: 'Salju ☃ 😀', pho: 1 }, bad: [] }] };
    const t = allText(await bytesOf(await buildPdf(meta, [odd], [])));
    expect(t).toContain('Salju ? ?');
  });
  it('embeds one image per chart', async () => {
    const charts: PdfChart[] = [
      { section: 'air', title: 'pH harian', dataUrl: PNG, width: 340, height: 220, legend: [{ label: 'Outlet', color: '#0E7C66' }] },
      { section: 'air', title: 'TSS harian', dataUrl: PNG, width: 340, height: 220, legend: [] },
    ];
    const u = await bytesOf(await buildPdf(meta, [section(3)], charts));
    expect((latin(u).match(/\/Subtype\s*\/Image/g) ?? []).length).toBe(2);
    expect(allText(u)).toContain('pH harian');
  });
  it('no sections still gives a valid PDF', async () => {
    const u = await bytesOf(await buildPdf(meta, [], []));
    expect(latin(u.slice(0, 5))).toBe('%PDF-');
  });
  it('a section with no rows says so', async () => {
    const t = allText(await bytesOf(await buildPdf(meta, [section(0)], [])));
    expect(t).toContain('Tidak ada data pada periode ini.');
  });
});

describe('pdfSafe', () => {
  it('keeps Latin text and the superscript, replaces other symbols and control characters', () => {
    expect(pdfSafe('Debit (m³/d) Café')).toBe('Debit (m³/d) Café');
    expect(pdfSafe('a☃b')).toBe('a?b');
    expect(pdfSafe('a\u0001b')).toBe('ab');
  });
});
