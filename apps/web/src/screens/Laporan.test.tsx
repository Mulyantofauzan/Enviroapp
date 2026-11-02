import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unzipSync } from 'fflate';
import type { Role } from '@evo/shared';
import { mockApi, renderApp, json, POND } from '../test-utils';

vi.mock('../lib/chartImage', () => ({ chartToPng: vi.fn(async () => ({ dataUrl: 'data:image/png;base64,AAAA', width: 340, height: 220 })) }));
vi.mock('../lib/pdf', () => ({ buildPdf: vi.fn(async () => new Blob(['%PDF-'], { type: 'application/pdf' })) }));
import { chartToPng } from '../lib/chartImage';
import { buildPdf } from '../lib/pdf';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); try { localStorage.clear(); } catch { /* ignore */ } });

const water = (o = {}) => ({ ph_inlet: 7, ph_outlet: 7.1, tss_inlet: 100, tss_outlet: 30, debit_inlet_m3d: 1000, debit_outlet_m3d: 1278.7, ...o });
const wx = { rainfall_mm: 12.5, rain_hours: 3 };
const entry = (date: string, o: Record<string, unknown> = {}) => ({ date, sp_id: 'p1', weather: wx, water: water(), coagulant: [{ type: 'Tawas Serbuk', stock_in: 0, stock_out: 5, stock_remaining: 50, staleRemaining: false }], ...o });
const days = (n: number) => Array.from({ length: n }, (_, i) => entry(new Date(Date.parse('2026-09-01T00:00:00Z') + i * 86_400_000).toISOString().slice(0, 10)));

function setup(role: Role = 'Manager', history: unknown[] = [entry('2026-11-02', { water: water({ ph_outlet: 5.8 }) }), entry('2026-11-01')], events: unknown[] = []) {
  return mockApi({
    role,
    handler: (url) => {
      if (url.startsWith('/api/history')) return json(history);
      if (url.startsWith('/api/events?')) return json({ today: '2026-11-02', events });
      return undefined;
    },
  });
}
const hist = (calls: { url: string }[]) => calls.filter((c) => c.url.startsWith('/api/history')).map((c) => new URL(c.url, 'http://x').searchParams);
const ready = async () => {
  await screen.findByRole('heading', { name: 'Laporan' });
  await waitFor(() => expect((fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.some((c) => String(c[0]).startsWith('/api/history'))).toBe(true));
  await waitFor(() => expect(screen.queryByText('Memuat data…')).toBeNull());
};

describe('Laporan: access', () => {
  it.each(['Manager', 'Admin', 'Auditor'] as Role[])('%s can open it', async (role) => {
    setup(role);
    renderApp('/laporan');
    expect(await screen.findByRole('heading', { name: 'Laporan' })).toBeInTheDocument();
    expect(screen.getByText('Tarik data dan unduh untuk presentasi')).toBeInTheDocument();
  });
});

describe('Laporan: filters and data', () => {
  it('starts with the last 7 days, today coming from the server, for the active pond', async () => {
    const calls = setup();
    renderApp('/laporan');
    await ready();
    const q = hist(calls).find((p) => p.get('from') === '2026-10-27')!;
    expect(q.get('to')).toBe('2026-11-02');
    expect(q.get('sp')).toBe(POND.id);
    expect(screen.getByRole('tab', { name: '7 hari' })).toHaveAttribute('aria-selected', 'true');
  });
  it('30 hari and Bulan lalu change the range', async () => {
    const calls = setup();
    renderApp('/laporan');
    await ready();
    await userEvent.click(screen.getByRole('tab', { name: '30 hari' }));
    await waitFor(() => expect(hist(calls).some((p) => p.get('from') === '2026-10-04')).toBe(true));
    await userEvent.click(screen.getByRole('tab', { name: 'Bulan lalu' }));
    await waitFor(() => expect(hist(calls).some((p) => p.get('from') === '2026-10-01' && p.get('to') === '2026-10-31')).toBe(true));
  });
  it('a custom range over 366 days shows a message and disables export', async () => {
    setup();
    renderApp('/laporan');
    await ready();
    await userEvent.click(screen.getByRole('tab', { name: 'Atur sendiri' }));
    fireEvent.change(screen.getByLabelText('Dari'), { target: { value: '2025-01-01' } });
    expect(await screen.findByText('Pilih rentang 366 hari atau kurang.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ekspor Excel (.xlsx)' })).toBeDisabled();
  });
  it('All locations drops the sp filter', async () => {
    const calls = setup();
    renderApp('/laporan');
    await ready();
    await userEvent.selectOptions(screen.getByLabelText('Lokasi'), '');
    await waitFor(() => expect(hist(calls).some((p) => p.get('from') === '2026-10-27' && !p.has('sp'))).toBe(true));
  });
});

describe('Laporan: chips', () => {
  it('the last active chip cannot be switched off', async () => {
    setup();
    renderApp('/laporan');
    await ready();
    const chips = ['Cuaca', 'Air Permukaan', 'Koagulan'].map((n) => screen.getByRole('button', { name: n }));
    expect(screen.getByRole('button', { name: 'Event' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chips[0]);
    await userEvent.click(chips[1]);
    await userEvent.click(chips[2]);
    expect(chips[2]).toHaveAttribute('aria-pressed', 'true');
  });
  it('events load only after the Event chip is on, window by window', async () => {
    const calls = setup();
    renderApp('/laporan');
    await ready();
    expect(calls.some((c) => c.url.startsWith('/api/events?'))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Event' }));
    await waitFor(() => expect(calls.some((c) => c.url.startsWith('/api/events?'))).toBe(true));
  });
});

describe('Laporan: preview', () => {
  it('marks an out-of-limit outlet pH red and explains it', async () => {
    setup();
    renderApp('/laporan');
    await ready();
    await userEvent.click(screen.getByRole('tab', { name: 'Air Permukaan' }));
    const table = await screen.findByRole('region', { name: 'Air Permukaan' });
    const cell = within(table).getByRole('cell', { name: '5,8' });
    expect(cell.className).toContain('is-bad');
    expect(screen.getByText(/Sel merah menandai nilai di luar baku mutu/)).toBeInTheDocument();
  });
  it('says how many rows the preview shows', async () => {
    setup('Manager', days(60));
    renderApp('/laporan');
    await ready();
    await userEvent.click(screen.getByRole('tab', { name: 'Air Permukaan' }));
    expect(await screen.findByText('Pratinjau 50 dari 60 baris')).toBeInTheDocument();
  });
  it('empty and error states', async () => {
    setup('Manager', []);
    const { unmount } = renderApp('/laporan');
    await ready();
    expect(await screen.findByText('Tidak ada data pada periode ini.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ekspor Excel (.xlsx)' })).toBeDisabled();
    unmount();
    mockApi({ role: 'Manager', handler: (url) => (url.startsWith('/api/history') ? json({ error: 'Basis data sibuk.' }, 500) : undefined) });
    renderApp('/laporan');
    expect(await screen.findByRole('alert')).toHaveTextContent('Basis data sibuk.');
  });
});

describe('Laporan: charts', () => {
  it('weather chip shows the three rainfall charts with data labels', async () => {
    setup();
    renderApp('/laporan');
    await ready();
    expect(await screen.findByRole('heading', { name: 'Curah hujan, 7 hari terakhir' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rata-rata curah hujan per minggu, 5 minggu terakhir' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rata-rata curah hujan per bulan, 12 bulan terakhir' })).toBeInTheDocument();
    const card = screen.getByRole('heading', { name: 'Curah hujan, 7 hari terakhir' }).closest('section')!;
    expect(card.querySelectorAll('text.ui-chart__label').length).toBeGreaterThan(0);
  });
  it('water charts need one location; coagulant charts still work for all locations', async () => {
    setup();
    renderApp('/laporan');
    await ready();
    expect(await screen.findByRole('heading', { name: 'pH harian' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Lokasi'), '');
    expect(await screen.findAllByText('Pilih satu lokasi untuk melihat grafik air permukaan.')).not.toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Penggunaan tawas per minggu, 5 minggu terakhir' })).toBeInTheDocument();
  });
  it('turning a chip off removes its charts', async () => {
    setup();
    renderApp('/laporan');
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Cuaca' }));
    expect(screen.queryByRole('heading', { name: 'Curah hujan, 7 hari terakhir' })).toBeNull();
  });
});

describe('Laporan: Excel export', () => {
  it('downloads a real workbook named after location and range', async () => {
    setup();
    const blobs: Blob[] = [];
    const names: string[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => { blobs.push(b); return 'blob:x'; });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
    renderApp('/laporan');
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Ekspor Excel (.xlsx)' }));
    await waitFor(() => expect(names).toEqual(['laporan-evo-SP-02_Pit_Selatan-2026-10-27-2026-11-02.xlsx']));
    const bytes = await new Promise<Uint8Array>((res) => { const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result as ArrayBuffer)); r.readAsArrayBuffer(blobs[0]); });
    const files = unzipSync(bytes);
    expect(files['xl/workbook.xml']).toBeDefined();
    expect(Object.keys(files).filter((n) => n.startsWith('xl/worksheets/sheet'))).toHaveLength(4); // Ringkasan + 3 default chips
  });
  it('refuses more than 20.000 rows without downloading', async () => {
    setup('Manager', days(7001)); // three sections of 7.001 rows each
    const names: string[] = [];
    URL.createObjectURL = vi.fn(() => 'blob:x');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
    renderApp('/laporan');
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Ekspor Excel (.xlsx)' }));
    expect(await screen.findByRole('alert', {}, { timeout: 20000 })).toHaveTextContent(/Ada 21\.003 baris\. Persempit periode agar tidak lebih dari 20\.000\./);
    expect(names).toEqual([]);
  }, 40000);
});

describe('Laporan: PDF export', () => {
  it('turns each chart into an image, builds the PDF and downloads it under the right name', async () => {
    setup();
    const names: string[] = [];
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
    renderApp('/laporan');
    await ready();
    await screen.findByRole('heading', { name: 'pH harian' });
    await userEvent.click(screen.getByRole('button', { name: 'Ekspor PDF' }));
    await waitFor(() => expect(names).toEqual(['laporan-evo-SP-02_Pit_Selatan-2026-10-27-2026-11-02.pdf']));
    const charts = vi.mocked(buildPdf).mock.calls.at(-1)![2];
    expect(charts.length).toBeGreaterThanOrEqual(7);
    expect(new Set(charts.map((c) => c.section))).toEqual(new Set(['cuaca', 'air', 'koagulan']));
    expect(charts.find((c) => c.title === 'pH harian')!.legend.map((l) => l.label)).toContain('Outlet');
    expect(vi.mocked(chartToPng)).toHaveBeenCalled();
  });
  it('a failed chart image shows a message and downloads nothing', async () => {
    setup();
    vi.mocked(chartToPng).mockRejectedValueOnce(new Error('Grafik tidak bisa dibuat menjadi gambar.'));
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
    renderApp('/laporan');
    await ready();
    await screen.findByRole('heading', { name: 'pH harian' });
    await userEvent.click(screen.getByRole('button', { name: 'Ekspor PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Grafik tidak bisa dibuat menjadi gambar.');
    expect(names).toEqual([]);
  });
  it('both export buttons wait while a file is being prepared', async () => {
    setup();
    let release!: () => void;
    vi.mocked(buildPdf).mockImplementationOnce(() => new Promise((r) => { release = () => r(new Blob(['x'])); }));
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderApp('/laporan');
    await ready();
    await screen.findByRole('heading', { name: 'pH harian' });
    await userEvent.click(screen.getByRole('button', { name: 'Ekspor PDF' }));
    expect(await screen.findByRole('button', { name: 'Menyiapkan…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ekspor Excel (.xlsx)' })).toBeDisabled();
    release();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ekspor PDF' })).toBeEnabled());
  });
});
