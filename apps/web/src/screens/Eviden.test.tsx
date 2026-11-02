import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Role } from '@evo/shared';
import { mockApi, renderApp, json } from '../test-utils';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); try { localStorage.clear(); } catch { /* ignore */ } });

const item = (n: number, o: Record<string, unknown> = {}) => ({
  id: `e${n}`, filename: `foto-${n}.jpg`, mime: 'image/jpeg', size: 2048, source: 'camera',
  gps_lat: -3.78421, gps_lng: 115.60214, gps_accuracy: 8, taken_at: '2026-11-02T00:34:12.000Z', uploaded_at: '2026-11-02T00:35:00.000Z',
  uploaded_by_name: 'Rudi Hartono', uploaded_by_role: 'Operator', schedule_id: 's1', title: 'Cek pompa', due_date: '2026-11-02', sp_id: 'p1', ...o,
});
const SCHEDULES = [
  { id: 's1', title: 'Cek pompa', frequency: 'Daily', start_date: '2026-10-01', sp_id: null, ended_on: null },
  { id: 's2', title: 'Kuras kolam', frequency: 'Monthly', start_date: '2026-10-01', sp_id: null, ended_on: '2026-10-20' },
];

function setup(role: Role, items = [item(1), item(2, { source: 'gallery', gps_lat: null, gps_lng: null })], total = items.length) {
  return mockApi({
    role,
    handler: (url) => {
      if (url.startsWith('/api/evidence?')) return json({ total, items });
      if (url.startsWith('/api/schedules')) return json(SCHEDULES);
      return undefined;
    },
  });
}
const listCalls = (calls: { url: string }[]) => calls.filter((c) => c.url.startsWith('/api/evidence?'));

describe('Eviden', () => {
  it('shows the heading and the read-only badge only for the auditor', async () => {
    setup('Auditor');
    const { unmount } = renderApp('/eviden');
    expect(await screen.findByRole('heading', { name: 'Eviden Lapangan' })).toBeInTheDocument();
    expect(screen.getByText('Hanya baca')).toBeInTheDocument();
    unmount();
    setup('Operator');
    renderApp('/eviden');
    await screen.findByRole('heading', { name: 'Eviden Lapangan' });
    expect(screen.queryByText('Hanya baca')).toBeNull();
  });

  it('asks for the last 30 days first and 7 or 90 on request', async () => {
    const calls = setup('Auditor');
    renderApp('/eviden');
    await screen.findAllByRole('heading', { name: 'Cek pompa' });
    let q = new URL(listCalls(calls).at(-1)!.url, 'http://x').searchParams;
    expect(q.get('to')).toBe('2026-11-02');
    expect(q.get('from')).toBe('2026-10-04');
    await userEvent.click(screen.getByRole('tab', { name: '7 hari' }));
    await waitFor(() => expect(new URL(listCalls(calls).at(-1)!.url, 'http://x').searchParams.get('from')).toBe('2026-10-27'));
    await userEvent.click(screen.getByRole('tab', { name: '90 hari' }));
    await waitFor(() => expect(new URL(listCalls(calls).at(-1)!.url, 'http://x').searchParams.get('from')).toBe('2026-08-05'));
    q = new URL(listCalls(calls).at(-1)!.url, 'http://x').searchParams;
    expect(q.get('to')).toBe('2026-11-02');
  });

  it('has a chip for All and one per schedule title, and picking one filters by schedule', async () => {
    const calls = setup('Auditor');
    renderApp('/eviden');
    await screen.findByRole('tab', { name: 'Kuras kolam' });
    expect(screen.getByRole('tab', { name: 'Semua' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Kuras kolam' }));
    await waitFor(() => expect(new URL(listCalls(calls).at(-1)!.url, 'http://x').searchParams.get('schedule')).toBe('s2'));
  });

  it('renders a card with image, title, date, uploader and location or badge', async () => {
    setup('Auditor');
    renderApp('/eviden');
    const img = await screen.findByAltText('foto-1.jpg');
    expect(img).toHaveAttribute('src', '/api/evidence/e1/file');
    expect(screen.getAllByText('Rudi Hartono - Operator').length).toBe(2);
    expect(screen.getByText(/GPS -3\.78421, 115\.60214/)).toBeInTheDocument();
    expect(screen.getByText('Galeri')).toBeInTheDocument();
    const dl = screen.getAllByRole('link', { name: /Unduh/ })[0];
    expect(dl).toHaveAttribute('href', '/api/evidence/e1/file');
    expect(dl).toHaveAttribute('download');
  });

  it('opens the preview from the button', async () => {
    setup('Auditor');
    renderApp('/eviden');
    await screen.findByAltText('foto-1.jpg');
    await userEvent.click(screen.getAllByRole('button', { name: /Pratinjau/ })[0]);
    const dlg = screen.getByRole('dialog', { name: 'Pratinjau eviden' });
    expect(within(dlg).getByAltText('foto-1.jpg')).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Tutup' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a PDF gets a document icon and no image or preview', async () => {
    setup('Auditor', [item(3, { mime: 'application/pdf', filename: 'surat.pdf', source: 'gallery', gps_lat: null, gps_lng: null })]);
    renderApp('/eviden');
    await screen.findByText('surat.pdf');
    expect(screen.queryByAltText('surat.pdf')).toBeNull();
    expect(screen.queryByRole('button', { name: /Pratinjau/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Unduh/ })).toBeInTheDocument();
  });

  it('loads more with the next offset and keeps the earlier cards', async () => {
    const calls = mockApi({
      role: 'Auditor',
      handler: (url) => {
        if (url.startsWith('/api/evidence?')) {
          const off = Number(new URL(url, 'http://x').searchParams.get('offset') ?? 0);
          return json({ total: 3, items: off === 0 ? [item(1), item(2)] : [item(3)] });
        }
        if (url.startsWith('/api/schedules')) return json(SCHEDULES);
        return undefined;
      },
    });
    renderApp('/eviden');
    await screen.findByAltText('foto-1.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Muat lebih banyak' }));
    expect(await screen.findByAltText('foto-3.jpg')).toBeInTheDocument();
    expect(screen.getByAltText('foto-1.jpg')).toBeInTheDocument();
    expect(new URL(listCalls(calls).at(-1)!.url, 'http://x').searchParams.get('offset')).toBe('2');
    expect(screen.queryByRole('button', { name: 'Muat lebih banyak' })).toBeNull();
  });

  it('says so when the range is empty', async () => {
    setup('Auditor', [], 0);
    renderApp('/eviden');
    expect(await screen.findByText('Belum ada eviden pada rentang ini.')).toBeInTheDocument();
  });

  it('shows the cause when loading fails', async () => {
    mockApi({ role: 'Auditor', handler: (url) => (url.startsWith('/api/evidence?') ? json({ error: 'Rentang terlalu panjang.' }, 400) : undefined) });
    renderApp('/eviden');
    expect(await screen.findByRole('alert')).toHaveTextContent('Rentang terlalu panjang.');
  });

  it.each(['Auditor', 'Manager', 'Operator'] as Role[])('%s has no delete, camera or upload here', async (role) => {
    setup(role);
    renderApp('/eviden');
    await screen.findByAltText('foto-1.jpg');
    expect(screen.queryByRole('button', { name: /Hapus|Ambil foto|Unggah/ })).toBeNull();
    expect(screen.queryByText(/Unggah galeri/)).toBeNull();
  });
});

describe('Eviden ZIP', () => {
  const three = [item(1), item(2), item(3)];
  function zipSetup(opts: { total?: number; failId?: string; gate?: Promise<void> } = {}) {
    const fileCalls: string[] = [];
    const calls = mockApi({
      role: 'Auditor',
      handler: (url) => {
        if (url.startsWith('/api/evidence?')) return json({ total: opts.total ?? 3, items: three });
        if (url.startsWith('/api/schedules')) return json(SCHEDULES);
        const m = url.match(/^\/api\/evidence\/(\w+)\/file$/);
        if (m) {
          fileCalls.push(m[1]);
          if (m[1] === opts.failId) return new Response('x', { status: 500 });
          if (m[1] === 'e3' && opts.gate) return opts.gate.then(() => new Response(new Uint8Array([3])));
          return new Response(new Uint8Array([Number(m[1].slice(1))]));
        }
        return undefined;
      },
    });
    const downloads: string[] = [];
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download); });
    return { calls, fileCalls, downloads };
  }

  it('is disabled when there is nothing to download', async () => {
    setup('Auditor', [], 0);
    renderApp('/eviden');
    await screen.findByText('Belum ada eviden pada rentang ini.');
    expect(screen.getByRole('button', { name: 'Unduh semua eviden (ZIP)' })).toBeDisabled();
  });

  it('downloads every file in order and names the zip after the range', async () => {
    const { calls, fileCalls, downloads } = zipSetup();
    renderApp('/eviden');
    await screen.findByAltText('foto-1.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Unduh semua eviden (ZIP)' }));
    await waitFor(() => expect(downloads).toEqual(['eviden-2026-10-04-2026-11-02.zip']));
    expect(fileCalls).toEqual(['e1', 'e2', 'e3']);
    expect(listCalls(calls).some((c) => new URL(c.url, 'http://x').searchParams.get('limit') === '100')).toBe(true);
  });

  it('refuses over 100 and fetches no file', async () => {
    const { fileCalls, downloads } = zipSetup({ total: 101 });
    renderApp('/eviden');
    await screen.findByAltText('foto-1.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Unduh semua eviden (ZIP)' }));
    expect(await screen.findByText('Ada 101 eviden. Persempit rentang agar tidak lebih dari 100.')).toBeInTheDocument();
    expect(fileCalls).toEqual([]);
    expect(downloads).toEqual([]);
  });

  it('shows progress and disables the button while running', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const { downloads } = zipSetup({ gate });
    renderApp('/eviden');
    await screen.findByAltText('foto-1.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Unduh semua eviden (ZIP)' }));
    expect(await screen.findByText('Menyiapkan 2 dari 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Menyiapkan|Unduh semua/ })).toBeDisabled();
    release();
    await waitFor(() => expect(downloads.length).toBe(1));
  });

  it('a failed file shows its name and starts no download', async () => {
    const { downloads } = zipSetup({ failId: 'e2' });
    renderApp('/eviden');
    await screen.findByAltText('foto-1.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Unduh semua eviden (ZIP)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('foto-2.jpg');
    expect(downloads).toEqual([]);
  });
});
