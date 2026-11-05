import { describe, it, expect, vi } from 'vitest';
import type { HistoryEntry } from '../report';
import type { Pond } from '../../pond/PondContext';
import { buildPptxReport } from './export';
import type { SlideInput } from '../pdf/slides';

const TO = '2026-11-02';
const pond = (id: string, code: string, name: string, active = true): Pond => ({ id, code, name, is_active: active });
const ponds = [pond('b', 'SP 12', 'KGE'), pond('a', 'SP 11', 'LGG'), pond('c', 'SP 13', 'Kosong')];
const water = { ph_inlet: 7, ph_outlet: 7, tss_inlet: 1, tss_outlet: 1, debit_inlet_m3d: 1, debit_outlet_m3d: 1 };
const entry = (sp: string | null, o: Partial<HistoryEntry> = {}): HistoryEntry => ({ date: '2026-11-01', sp_id: sp, weather: { rainfall_mm: 1, rain_hours: 1 }, water: null, coagulant: [], ...o });
const history = [entry('a', { water }), entry('b', { water }), entry(null)];

async function run(sp: string) {
  let input: SlideInput | null = null;
  const fetchJson = vi.fn(async (url: string) => (url.startsWith('/history/coagulant-total') ? { ponds: [] } : history));
  const build = vi.fn(async (i: SlideInput) => { input = i; return new Blob(['x']); });
  await buildPptxReport({ to: TO, sp, kinds: ['cuaca', 'air', 'koagulan'], ponds, eventSection: null, fetchJson: fetchJson as never, build: build as never });
  return input!;
}

describe('buildPptxReport', () => {
  it('"Semua pond": one weather page and one page per pond that has data, sorted by code', async () => {
    const i = await run('');
    expect(i.weather).not.toBeNull();
    expect(i.ponds.map((p) => p.title)).toEqual(['SP 11 LGG MONITORING', 'SP 12 KGE MONITORING']);
  });
  it('one pond: weather plus only that pond', async () => {
    const i = await run('a');
    expect(i.weather).not.toBeNull();
    expect(i.ponds.map((p) => p.title)).toEqual(['SP 11 LGG MONITORING']);
  });
});
