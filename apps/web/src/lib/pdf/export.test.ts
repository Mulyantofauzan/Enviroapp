import { describe, it, expect, vi } from 'vitest';
import type { HistoryEntry, ReportSection } from '../report';
import type { Pond } from '../../pond/PondContext';
import { buildPdfReport } from './export';
import type { SlideInput } from './slides';

const TO = '2026-11-02';
const pond = (id: string, code: string | null, name: string, active = true): Pond => ({ id, code, name, is_active: active });
const ponds = [pond('b', 'SP 12', 'KGE'), pond('a', 'SP 11', 'LGG'), pond('c', 'SP 13', 'Kosong'), pond('d', 'SP 10', 'Mati', false)];
const water = { ph_inlet: 7, ph_outlet: 7, tss_inlet: 1, tss_outlet: 1, debit_inlet_m3d: 1, debit_outlet_m3d: 1 };
const entry = (sp: string | null, o: Partial<HistoryEntry> = {}): HistoryEntry => ({ date: '2026-11-01', sp_id: sp, weather: { rainfall_mm: 1, rain_hours: 1 }, water: null, coagulant: [], ...o });
const history: HistoryEntry[] = [entry('a', { water }), entry('b', { water }), entry(null)];
const ev = (n: number): ReportSection => ({ id: 'event', title: 'Event', columns: [{ key: 'a', header: 'Judul', kind: 'text' }], rows: Array.from({ length: n }, () => ({ cells: { a: 'x' }, bad: [] })) });

function run(o: { sp?: string; kinds?: ('cuaca' | 'air' | 'koagulan' | 'event')[]; event?: ReportSection | null; history?: HistoryEntry[] } = {}) {
  const urls: string[] = [];
  let captured: SlideInput | null = null;
  const fetchJson = vi.fn(async (url: string) => {
    urls.push(url);
    if (url.startsWith('/history/coagulant-total')) return { ponds: [{ sp_id: 'a', first_date: '2020-01-01', 'Tawas Serbuk': 300, 'Tawas Batu': 100, Kapur: 9 }] };
    return o.history ?? history;
  });
  const build = vi.fn(async (input: SlideInput) => { captured = input; return new Blob(['%PDF-']); });
  const done = buildPdfReport({
    to: TO, sp: o.sp ?? '', kinds: o.kinds ?? ['cuaca', 'air', 'koagulan'], ponds, eventSection: o.event ?? null,
    fetchJson: fetchJson as never, build: build as never,
  });
  return { urls, fetchJson, done, input: () => captured! };
}

describe('buildPdfReport', () => {
  it('fetches one year of history ending at `to`, in one request', async () => {
    const r = run();
    await r.done;
    const h = r.urls.filter((u) => u.startsWith('/history?'));
    expect(h).toHaveLength(1);
    expect(h[0]).toContain('from=2025-11-02');
    expect(h[0]).toContain(`to=${TO}`);
    expect(h[0]).not.toContain('sp=');
  });

  it('passes sp along to both requests', async () => {
    const r = run({ sp: 'a' });
    await r.done;
    expect(r.urls.every((u) => u.includes('sp=a'))).toBe(true);
  });

  it('asks for the lifetime total only with the Air or Koagulan chip', async () => {
    const withAir = run({ kinds: ['air'] });
    await withAir.done;
    expect(withAir.urls.some((u) => u.startsWith('/history/coagulant-total'))).toBe(true);
    const weatherOnly = run({ kinds: ['cuaca'] });
    await weatherOnly.done;
    expect(weatherOnly.urls.some((u) => u.startsWith('/history/coagulant-total'))).toBe(false);
    expect(weatherOnly.input().ponds).toEqual([]);
    expect(weatherOnly.input().weather).not.toBeNull();
  });

  it('"Semua lokasi": one page per pond that has data, sorted by code, one weather page', async () => {
    const r = run();
    await r.done;
    expect(r.input().ponds.map((p) => p.title)).toEqual(['SP 11 LGG MONITORING', 'SP 12 KGE MONITORING']);
    expect(r.input().weather).not.toBeNull();
  });

  it('a chosen pond without data still gets its page, with the lifetime total', async () => {
    const r = run({ sp: 'c', history: [] });
    await r.done;
    expect(r.input().ponds.map((p) => p.title)).toEqual(['SP 13 KOSONG MONITORING']);
    const a = run({ sp: 'a' });
    await a.done;
    expect(a.input().ponds[0].project).toEqual({ kg: 400, bags: 16 });
  });

  it('adds the Event table only when the chip is on and it has rows', async () => {
    const on = run({ kinds: ['event'], event: ev(2) });
    await on.done;
    expect(on.input().event?.rows).toHaveLength(2);
    const empty = run({ kinds: ['event'], event: ev(0) });
    await empty.done;
    expect(empty.input().event).toBeNull();
    const off = run({ kinds: ['cuaca'], event: ev(2) });
    await off.done;
    expect(off.input().event).toBeNull();
  });

  it('rejects with the network error as is', async () => {
    await expect(buildPdfReport({
      to: TO, sp: '', kinds: ['cuaca'], ponds, eventSection: null,
      fetchJson: (async () => { throw new Error('Tidak bisa terhubung.'); }) as never,
    })).rejects.toThrow('Tidak bisa terhubung.');
  });
});
