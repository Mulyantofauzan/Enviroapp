import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReportData } from './useReportData';
import type { ReportKind } from '../lib/report';

afterEach(() => vi.unstubAllGlobals());
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });

function stub(opts: { gate?: Promise<void>; eventFail?: string } = {}) {
  const urls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url);
    if (url.startsWith('/api/history')) {
      if (opts.gate && url.includes('from=2026-10-01')) await opts.gate;
      return json([{ date: url.includes('from=2026-10-01') ? '2026-10-02' : '2025-12-01', sp_id: null, weather: null, water: null, coagulant: [] }]);
    }
    if (url.startsWith('/api/events?')) {
      if (opts.eventFail && url.includes(opts.eventFail)) return json({ error: 'gagal' }, 500);
      return json({ today: '2026-11-02', events: [] });
    }
    return json({});
  }));
  return urls;
}
const base = { from: '2026-10-01', to: '2026-11-02', sp: '', today: '2026-11-02' as string | null };
const run = (kinds: ReportKind[], o: Partial<typeof base> & { sp?: string } = {}) => renderHook((p: { kinds: ReportKind[] } & typeof base) => useReportData(p), { initialProps: { kinds, ...base, ...o } });

describe('useReportData', () => {
  it('loads history for the period, with sp only when given', async () => {
    const urls = stub();
    const { result, rerender } = run(['air']);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(urls.find((u) => u.includes('from=2026-10-01'))).toBe('/api/history?from=2026-10-01&to=2026-11-02');
    rerender({ kinds: ['air'], ...base, sp: 'p1' });
    await waitFor(() => expect(urls.some((u) => u.includes('sp=p1'))).toBe(true));
  });
  it('fetches the year only when weather or coagulant charts need it', async () => {
    const urls = stub();
    const a = run(['air']);
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    expect(urls.filter((u) => u.includes('from=2025-11-02'))).toHaveLength(0);
    const b = run(['cuaca']);
    await waitFor(() => expect(b.result.current.ytd).not.toBeNull());
    expect(urls.some((u) => u.includes('from=2025-11-02&to=2026-11-02'))).toBe(true);
  });
  it('events: only with the event chip, one window at a time, in order', async () => {
    const urls = stub();
    const none = run(['air']);
    await waitFor(() => expect(none.result.current.loading).toBe(false));
    expect(urls.some((u) => u.startsWith('/api/events?'))).toBe(false);
    const { result } = run(['event'], { from: '2026-01-01', to: '2026-04-15' }); // 105 days -> 2 windows
    await waitFor(() => expect(result.current.events).not.toBeNull());
    const ev = urls.filter((u) => u.startsWith('/api/events?'));
    expect(ev).toEqual(['/api/events?from=2026-01-01&to=2026-03-03', '/api/events?from=2026-03-04&to=2026-04-15']);
  });
  it('a failing event window names its dates', async () => {
    stub({ eventFail: 'from=2026-03-04' });
    const { result } = run(['event'], { from: '2026-01-01', to: '2026-04-15' });
    await waitFor(() => expect(result.current.error).toContain('4 Mar 2026'));
    expect(result.current.error).toContain('15 Apr 2026');
  });
  it('does nothing until today is known', async () => {
    const urls = stub();
    run(['air'], { today: null });
    await new Promise((r) => setTimeout(r, 30));
    expect(urls).toHaveLength(0);
  });
  it('drops a result that arrives after the parameters changed', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    stub({ gate });
    const { result, rerender } = run(['air']);
    rerender({ kinds: ['air'], ...base, from: '2026-10-20' });
    await waitFor(() => expect(result.current.entries).not.toBeNull());
    const current = result.current.entries;
    release();
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.entries).toBe(current);
  });
});
