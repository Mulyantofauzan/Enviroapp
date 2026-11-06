import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, renderApp } from '../test-utils';
import { buildImportTemplate } from '../lib/eventImport';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const template = () => new File([buildImportTemplate().slice()], 'event.xlsx');
const posts = (calls: { method: string; url: string; body: any }[]) => calls.filter((c) => c.method === 'POST' && c.url === '/api/schedules/import');

const PREVIEW = {
  summary: { create: 2, update: 1, unchanged: 0, skipped: 0, error: 0, newCategories: ['Air', 'Peralatan'] },
  rows: [
    { row: 2, title: 'Pemeriksaan kualitas air outlet', category: 'Air', status: 'create', newCategory: true },
    { row: 3, title: 'Kalibrasi alat ukur debit', category: 'Peralatan', status: 'update' },
    { row: 4, title: 'Pelaporan RKL-RPL tahunan', category: 'Perizinan', status: 'create' },
  ],
};

function setup(reply: (dry: boolean) => unknown = () => PREVIEW) {
  return mockApi({
    role: 'Manager',
    handler: (u, i) => {
      if (u.startsWith('/api/events/summary')) return json({ today: '2026-11-02', overdue: 0, due_today: 0 });
      if (u === '/api/schedules/import' && i?.method === 'POST') return json(reply(JSON.parse(String(i.body)).dry === true));
      return undefined;
    },
  });
}

describe('Impor event', () => {
  it('reading a file asks the server for a preview first, with the rows as the file has them', async () => {
    const calls = setup();
    renderApp('/kalender/jadwal/impor');
    await userEvent.upload(await screen.findByLabelText('Berkas Excel'), template());
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    const body = posts(calls)[0].body;
    expect(body.dry).toBe(true);
    expect(body.rows).toHaveLength(3);
    expect(body.rows[0]).toEqual({ row: 2, category: 'Air', title: 'Pemeriksaan kualitas air outlet', frequency: 'Bulanan', start: '2026-11-01' });
  });
  it('shows the counts, the new categories and each row with its result', async () => {
    setup();
    renderApp('/kalender/jadwal/impor');
    await userEvent.upload(await screen.findByLabelText('Berkas Excel'), template());
    const summary = await screen.findByRole('list', { name: 'Ringkasan' });
    expect(within(summary).getByText('Baru 2')).toBeInTheDocument();
    expect(within(summary).getByText('Diperbarui 1')).toBeInTheDocument();
    expect(within(summary).getByText('Bermasalah 0')).toBeInTheDocument();
    expect(screen.getByText(/Kategori baru: Air, Peralatan/)).toBeInTheDocument();
    expect(screen.getByText('Kalibrasi alat ukur debit')).toBeInTheDocument();
  });
  it('nothing is saved until Impor is pressed, and then the same rows go again without dry', async () => {
    const calls = setup();
    renderApp('/kalender/jadwal/impor');
    await userEvent.upload(await screen.findByLabelText('Berkas Excel'), template());
    await userEvent.click(await screen.findByRole('button', { name: 'Impor' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(2));
    expect(posts(calls)[1].body.dry).not.toBe(true);
    expect(posts(calls)[1].body.rows).toEqual(posts(calls)[0].body.rows);
    expect(await screen.findByText('Impor selesai: 2 baru, 1 diperbarui')).toBeInTheDocument();
  });
  it('Impor stays disabled when no row would change anything', async () => {
    setup(() => ({ summary: { create: 0, update: 0, unchanged: 3, skipped: 0, error: 0, newCategories: [] }, rows: PREVIEW.rows.map((r) => ({ ...r, status: 'unchanged' })) }));
    renderApp('/kalender/jadwal/impor');
    await userEvent.upload(await screen.findByLabelText('Berkas Excel'), template());
    await screen.findByText('Tidak berubah 3');
    expect(screen.getByRole('button', { name: 'Impor' })).toBeDisabled();
  });
  it('a file that is not an xlsx is explained and nothing is sent', async () => {
    const calls = setup();
    renderApp('/kalender/jadwal/impor');
    await userEvent.upload(await screen.findByLabelText('Berkas Excel'), new File(['x'], 'a.xlsx'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Berkas bukan .xlsx yang valid.');
    expect(posts(calls)).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Impor' })).toBeNull();
  });
  it('a server refusal is shown and the old preview is gone', async () => {
    mockApi({
      role: 'Manager',
      handler: (u, i) => (u === '/api/schedules/import' && i?.method === 'POST' ? json({ error: 'Berkas harus berisi 1 sampai 500 baris.' }, 400) : u.startsWith('/api/events/summary') ? json({ today: '2026-11-02', overdue: 0, due_today: 0 }) : undefined),
    });
    renderApp('/kalender/jadwal/impor');
    await userEvent.upload(await screen.findByLabelText('Berkas Excel'), template());
    expect(await screen.findByRole('alert')).toHaveTextContent('Berkas harus berisi 1 sampai 500 baris.');
    expect(screen.queryByRole('button', { name: 'Impor' })).toBeNull();
  });
  it('downloads the template', async () => {
    setup();
    const names: string[] = [];
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
    renderApp('/kalender/jadwal/impor');
    await userEvent.click(await screen.findByRole('button', { name: 'Unduh templat' }));
    expect(names).toEqual(['impor-event-templat.xlsx']);
  });
});
