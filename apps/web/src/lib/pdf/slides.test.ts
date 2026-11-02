import { describe, it, expect, vi } from 'vitest';
import { unzlibSync, strFromU8 } from 'fflate';
import type { ReportSection } from '../report';
import { pondPage, weatherPage } from './pages';
import { pdfSafe } from './safe';
import { buildSlidePdf, fitBanner } from './slides';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const raster = () => vi.fn(async (s: { width: number; height: number }) => ({ dataUrl: PNG, width: s.width, height: s.height }));
const bytesOf = (b: Blob) => new Promise<Uint8Array>((res) => { const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result as ArrayBuffer)); r.readAsArrayBuffer(b); });
const latin = (u: Uint8Array) => Array.from(u, (c) => String.fromCharCode(c)).join('');
const pages = (u: Uint8Array) => (latin(u).match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
const images = (u: Uint8Array) => (latin(u).match(/\/Subtype\s*\/Image/g) ?? []).length;
function allText(u: Uint8Array): string {
  const raw = latin(u);
  let out = raw;
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try { out += strFromU8(unzlibSync(Uint8Array.from(m[1], (c) => c.charCodeAt(0)))); } catch { /* not compressed text */ }
  }
  return out.replace(/\\([()])/g, '$1'); // parentheses are escaped inside PDF strings
}

const TO = '2026-10-25';
const weather = () => weatherPage([{ date: '2026-10-25', sp_id: null, weather: { rainfall_mm: 10.5, rain_hours: 1 }, water: null, coagulant: [] }, { date: '2026-10-24', sp_id: null, weather: { rainfall_mm: 6, rain_hours: 2 }, water: null, coagulant: [] }], TO);
const pond = (name = 'LGG', code: string | null = 'SP 11') => pondPage([], { id: 'p1', code, name, is_active: true }, TO, { serbuk: 100, batu: 50 });
const eventSection = (n: number): ReportSection => ({
  id: 'event', title: 'Event',
  columns: [{ key: 'a', header: 'Judul', kind: 'text' }],
  rows: Array.from({ length: n }, (_, i) => ({ cells: { a: `Cek pompa ${i}` }, bad: [] })),
});

describe('buildSlidePdf', () => {
  it('weather alone is one page with three charts', async () => {
    const r = raster();
    const u = await bytesOf(await buildSlidePdf({ weather: weather(), ponds: [], event: null }, r));
    expect(latin(u.slice(0, 5))).toBe('%PDF-');
    expect(pages(u)).toBe(1);
    expect(r).toHaveBeenCalledTimes(3);
    expect(images(u)).toBeGreaterThanOrEqual(1);
  });

  it('weather plus two ponds is three pages; each pond rasterizes six charts', async () => {
    const r = raster();
    const u = await bytesOf(await buildSlidePdf({ weather: weather(), ponds: [pond(), pond('KGE', 'SP 12')], event: null }, r));
    expect(pages(u)).toBe(3);
    expect(r).toHaveBeenCalledTimes(3 + 6 * 2);
  });

  it('writes the titles and table text where they can be found', async () => {
    const t = allText(await bytesOf(await buildSlidePdf({ weather: weather(), ponds: [pond()], event: null }, raster())));
    for (const s of ['WEATHER MONITORING', 'SP 11 LGG MONITORING', 'Rainfall (mm)', 'Intensity (mm/hrs)', '2 hari hujan', 'Total Tawas (kg)', 'Year To Date', 'Project To Date', 'Summary Penggunaan Koagulan']) expect(t).toContain(s);
  });

  it('a long event table adds pages and numbers only those', async () => {
    const u = await bytesOf(await buildSlidePdf({ weather: weather(), ponds: [], event: eventSection(200) }, raster()));
    expect(pages(u)).toBeGreaterThan(2);
    const t = allText(u);
    expect(t).toMatch(/Halaman 1 dari \d+/);
    expect(t).toContain('EVENT');
  });

  it('slide pages carry no page number, footer slogan or logo text', async () => {
    const t = allText(await bytesOf(await buildSlidePdf({ weather: weather(), ponds: [pond()], event: null }, raster())));
    expect(t).not.toContain('Halaman');
    expect(t).not.toContain('trusted');
    expect(t).not.toContain('reliable');
  });

  it('with nothing to draw it is still a valid one-page PDF with a message', async () => {
    const u = await bytesOf(await buildSlidePdf({ weather: null, ponds: [], event: eventSection(0) }, raster()));
    expect(latin(u.slice(0, 5))).toBe('%PDF-');
    expect(pages(u)).toBe(1);
    expect(allText(u)).toContain('Tidak ada data pada periode ini.');
  });

  it('a 60-character pond name with & does not throw', async () => {
    const name = 'PT Contoh & Rekan Settling Pond Utara Bagian Timur 12345 &&';
    const u = await bytesOf(await buildSlidePdf({ weather: null, ponds: [pond(name)], event: null }, raster()));
    expect(pages(u)).toBe(1);
  });
});

describe('pdfSafe', () => {
  it('keeps Latin text and ³, swaps characters Helvetica cannot draw for ?', () => {
    expect(pdfSafe('Débit m³/hari')).toBe('Débit m³/hari');
    expect(pdfSafe('Salju ☃')).toBe('Salju ?');
  });
});

describe('fitBanner', () => {
  const measure = (t: string, size: number) => t.length * size * 0.6;
  it('keeps the standard box and 17 pt for a short title', () => {
    expect(fitBanner('SP 11 LGG MONITORING', measure)).toEqual({ text: 'SP 11 LGG MONITORING', size: 17, width: 300 });
  });
  it('shrinks, then widens the box, so a long title is never cut off', () => {
    const r = fitBanner('SP 12 KOLAM PENGENDAPAN TAMBANG UTARA BLOK C MONITORING', measure);
    expect(r.width).toBeGreaterThan(300);
    expect(r.width).toBeLessThanOrEqual(786);
    expect(measure(r.text, r.size)).toBeLessThanOrEqual(r.width - 16);
  });
  it('truncates with an ellipsis only when even the widest box is too small', () => {
    const r = fitBanner('X'.repeat(200), measure);
    expect(r.width).toBe(786);
    expect(r.text.endsWith('...')).toBe(true);
    expect(measure(r.text, r.size)).toBeLessThanOrEqual(r.width - 16);
  });
});
