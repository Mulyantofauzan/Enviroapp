import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import type { ReportSection } from '../report';
import { pondPage, weatherPage } from '../pdf/pages';
import { buildSlidePptx } from './slides';

const bytesOf = (b: Blob) => new Promise<Uint8Array>((res) => { const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result as ArrayBuffer)); r.readAsArrayBuffer(b); });
const open = async (b: Blob) => unzipSync(await bytesOf(b));
const names = (z: Record<string, Uint8Array>, re: RegExp) => Object.keys(z).filter((n) => re.test(n));
const text = (z: Record<string, Uint8Array>, name: string) => strFromU8(z[name]);

const TO = '2026-10-25';
const weather = () => weatherPage([{ date: '2026-10-25', sp_id: null, weather: { rainfall_mm: 10.5, rain_hours: 1 }, water: null, coagulant: [] }], TO);
const water = { ph_inlet: 6.5, ph_outlet: 7.2, tss_inlet: 300, tss_outlet: 40, debit_inlet_m3d: 8640, debit_outlet_m3d: 8640 };
const pond = (name = 'LGG') => pondPage(
  [{ date: '2026-10-25', sp_id: 'p1', weather: null, water, coagulant: [{ type: 'Tawas Serbuk', stock_in: 0, stock_out: 50, stock_remaining: 100, staleRemaining: false }] }],
  { id: 'p1', code: 'SP 11', name, is_active: true, thresholds: { ph_outlet: { min: 6, max: 9 }, tss_outlet: { min: null, max: 50 } } } as never, TO, { serbuk: 100, batu: 50 });
const event = (n: number): ReportSection => ({
  id: 'event', title: 'Event', columns: [{ key: 'a', header: 'Judul', kind: 'text' }],
  rows: Array.from({ length: n }, (_, i) => ({ cells: { a: `Cek pompa ${i}` }, bad: [] })),
});

describe('buildSlidePptx', () => {
  it('weather alone is one slide with three native charts and a table', async () => {
    const z = await open(await buildSlidePptx({ weather: weather(), ponds: [], event: null }));
    expect(names(z, /^ppt\/slides\/slide\d+\.xml$/)).toHaveLength(1);
    expect(names(z, /^ppt\/charts\/chart\d+\.xml$/)).toHaveLength(3);
    expect(text(z, 'ppt/slides/slide1.xml')).toContain('WEATHER MONITORING');
    expect(text(z, 'ppt/slides/slide1.xml')).toContain('<a:tbl>');
  });
  it('one slide per pond: four charts plus two summary charts, with limit lines as chart series', async () => {
    const z = await open(await buildSlidePptx({ weather: null, ponds: [pond('LGG'), pond('KGE')], event: null }));
    expect(names(z, /^ppt\/slides\/slide\d+\.xml$/)).toHaveLength(2);
    expect(names(z, /^ppt\/charts\/chart\d+\.xml$/)).toHaveLength(12);
    const charts = names(z, /^ppt\/charts\/chart\d+\.xml$/).map((n) => text(z, n)).join('');
    expect(charts).toContain('pH Min');
    expect(charts).toContain('BML MHU');
    expect(text(z, 'ppt/slides/slide1.xml')).toContain('SP 11 LGG MONITORING');
  });
  it('weather plus ponds plus event keeps the PDF order and splits a long event list over slides', async () => {
    const z = await open(await buildSlidePptx({ weather: weather(), ponds: [pond()], event: event(80) }));
    const slides = names(z, /^ppt\/slides\/slide\d+\.xml$/);
    expect(slides.length).toBeGreaterThanOrEqual(4);
    expect(text(z, 'ppt/slides/slide1.xml')).toContain('WEATHER MONITORING');
    expect(text(z, 'ppt/slides/slide2.xml')).toContain('MONITORING');
    expect(text(z, 'ppt/slides/slide3.xml')).toContain('EVENT');
  });
  it('nothing to show gives one slide saying so', async () => {
    const z = await open(await buildSlidePptx({ weather: null, ponds: [], event: null }));
    expect(names(z, /^ppt\/slides\/slide\d+\.xml$/)).toHaveLength(1);
    expect(text(z, 'ppt/slides/slide1.xml')).toContain('Tidak ada data pada periode ini.');
  });
});
