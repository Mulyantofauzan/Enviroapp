import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Role } from '@evo/shared';
import { json, mockApi, renderApp } from '../test-utils';
import { buildDailyTemplate } from '../lib/dailyImport';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const template = () => new File([buildDailyTemplate().slice()], 'harian.xlsx');
const posts = (calls: { method: string; url: string; body: any }[]) => calls.filter((c) => c.method === 'POST' && c.url === '/api/entries/import');

const PREVIEW = {
  summary: { create: 2, update: 1, unchanged: 0, error: 0 },
  rows: [
    { row: 2, date: '2026-04-01', pond: 'SP11', status: 'create', parts: ['cuaca', 'air', 'koagulan'] },
    { row: 3, date: '2026-04-02', pond: 'SP11', status: 'update', parts: ['air'] },
    { row: 4, date: '2026-04-03', pond: 'SP11', status: 'create', parts: ['air', 'koagulan'] },
  ],
};

function setup(reply: (dry: boolean) => unknown = () => PREVIEW, role: Role = 'Admin') {
  return mockApi({
    role,
    handler: (u, i) => (u === '/api/entries/import' && i?.method === 'POST' ? json(reply(JSON.parse(String(i.body)).dry === true)) : undefined),
  });
}

describe('Impor data harian: access', () => {
  it('Admin can open it', async () => {
    setup();
    renderApp('/input/impor');
    expect(await screen.findByLabelText('Berkas Excel')).toBeInTheDocument();
  });
  it.each(['Operator', 'Manager'] as Role[])('%s cannot', async (role) => {
    setup(() => PREVIEW, role);
    renderApp('/input/impor');
    await screen.findByRole('heading', { name: /Halo|Dashboard/ });
    expect(screen.queryByLabelText('Berkas Excel')).toBeNull();
  });
});

describe('Impor data harian', () => {
  it('reading a file asks the server for a preview first, with the rows as the file has them', async () => {
    const calls = setup();
    renderApp('/input/impor');
    await userEvent.upload(await screen.findByLabelText('Berkas Excel'), template());
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    const body = posts(calls)[0].body;
    expect(body.dry).toBe(true);
    expect(body.rows).toHaveLength(3);
    expect(body.rows[0]).toMatchObject({ row: 2, date: '2026-04-01', pond: 'SP11', ph_outlet: '7,2', debit_outlet: '250' });
  });
  it('shows the counts and each row with its result and parts', async () => {
    setup();
    renderApp('/input/impor');
    await userEvent.upload(await screen.findByLabelText('Berkas Excel'), template());
    const summary = await screen.findByRole('list', { name: 'Ringkasan' });
    expect(within(summary).getByText('Baru 2')).toBeInTheDocument();
    expect(within(summary).getByText('Diperbarui 1')).toBeInTheDocument();
    expect(within(summary).getByText('Bermasalah 0')).toBeInTheDocument();
    expect(screen.getAllByText('Cuaca, Air, Koagulan').length).toBe(1);
  });
  it('shows the reason for a problem row', async () => {
    setup(() => ({ summary: { create: 0, update: 0, unchanged: 0, error: 1 }, rows: [{ row: 5, date: '2026-04-01', pond: 'SP50', status: 'error', message: 'Pond dengan kode SP50 tidak ditemukan.', parts: [] }] }));
    renderApp('/input/impor');
    await userEvent.upload(await screen.findByLabelText('Berkas Excel'), template());
    expect(await screen.findByText('Pond dengan kode SP50 tidak ditemukan.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Impor' })).toBeDisabled();
  });
  it('nothing is saved until Impor is pressed, and then the same rows go again without dry', async () => {
    const calls = setup();
    renderApp('/input/impor');
    await userEvent.upload(await screen.findByLabelText('Berkas Excel'), template());
    await userEvent.click(await screen.findByRole('button', { name: 'Impor' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(2));
    expect(posts(calls)[1].body.dry).not.toBe(true);
    expect(posts(calls)[1].body.rows).toEqual(posts(calls)[0].body.rows);
    expect(await screen.findByText('Impor selesai: 2 baru, 1 diperbarui')).toBeInTheDocument();
  });
  it('Impor stays disabled when no row would change anything', async () => {
    setup(() => ({ summary: { create: 0, update: 0, unchanged: 3, error: 0 }, rows: PREVIEW.rows.map((r) => ({ ...r, status: 'unchanged' })) }));
    renderApp('/input/impor');
    await userEvent.upload(await screen.findByLabelText('Berkas Excel'), template());
    await screen.findByText('Tidak berubah 3');
    expect(screen.getByRole('button', { name: 'Impor' })).toBeDisabled();
  });
  it('a file that is not an xlsx is explained and nothing is sent', async () => {
    const calls = setup();
    renderApp('/input/impor');
    await userEvent.upload(await screen.findByLabelText('Berkas Excel'), new File(['x'], 'a.xlsx'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Berkas bukan .xlsx yang valid.');
    expect(posts(calls)).toHaveLength(0);
  });
  it('a server refusal is shown and the old preview is gone', async () => {
    mockApi({ role: 'Admin', handler: (u, i) => (u === '/api/entries/import' && i?.method === 'POST' ? json({ error: 'Berkas harus berisi 1 sampai 1000 baris.' }, 400) : undefined) });
    renderApp('/input/impor');
    await userEvent.upload(await screen.findByLabelText('Berkas Excel'), template());
    expect(await screen.findByRole('alert')).toHaveTextContent('Berkas harus berisi 1 sampai 1000 baris.');
    expect(screen.queryByRole('button', { name: 'Impor' })).toBeNull();
  });
  it('downloads the template', async () => {
    setup();
    const names: string[] = [];
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
    renderApp('/input/impor');
    await userEvent.click(await screen.findByRole('button', { name: 'Unduh templat' }));
    expect(names).toEqual(['impor-data-harian-templat.xlsx']);
  });
});
