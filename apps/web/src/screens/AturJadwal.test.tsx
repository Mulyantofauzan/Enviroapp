import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, renderApp } from '../test-utils';

afterEach(() => vi.unstubAllGlobals());

const T = '2026-11-02';
const sch = (over: Record<string, unknown> = {}) => ({
  id: 's1', title: 'Cek Saluran Inlet', description: null, frequency: 'Daily', start_date: '2026-10-01', sp_id: 'p1', assigned_to: null,
  assigned_to_name: null, ended_on: null, locked: false, ...over,
});

function setup(schedules: unknown[] = [sch()], extra?: (u: string, i?: RequestInit) => Response | undefined) {
  return mockApi({
    role: 'Manager',
    handler: (u, i) => {
      const m = i?.method ?? 'GET';
      if (u.startsWith('/api/events/summary')) return json({ today: T, overdue: 0, due_today: 0 });
      if (u.startsWith('/api/schedules/assignees')) return json([{ id: 'u1', name: 'Rudi Hartono' }, { id: 'u2', name: 'Sinta Maharani' }]);
      if (u.startsWith('/api/schedules') && m === 'GET') return json(schedules);
      return extra?.(u, i);
    },
  });
}
const changes = (calls: { method: string; url: string; body: any }[]) => calls.filter((c) => c.method !== 'GET');

describe('Atur jadwal', () => {
  it('lists schedules with frequency, pond and status chip', async () => {
    setup([sch(), sch({ id: 's2', title: 'Uji Air Bulanan', frequency: 'Monthly', sp_id: null, ended_on: '2026-10-20' })]);
    renderApp('/kalender/jadwal');
    const a = await screen.findByRole('article', { name: 'Cek Saluran Inlet' });
    expect(within(a).getByText(/Harian - SP-02 Pit Selatan/)).toBeInTheDocument();
    expect(within(a).getByText('Aktif')).toBeInTheDocument();
    const b = screen.getByRole('article', { name: 'Uji Air Bulanan' });
    expect(within(b).getByText(/Bulanan - Semua lokasi/)).toBeInTheDocument();
    expect(within(b).getByText('Berhenti')).toBeInTheDocument();
    expect(within(b).queryByRole('button', { name: /Hentikan/ })).toBeNull();
  });
  it('says what to do when there is nothing yet', async () => {
    setup([]);
    renderApp('/kalender/jadwal');
    expect(await screen.findByText('Belum ada jadwal. Tambahkan yang pertama.')).toBeInTheDocument();
  });
  it('adds a schedule, start date defaulting to today', async () => {
    const calls = setup([]);
    renderApp('/kalender/jadwal');
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah jadwal' }));
    expect(screen.getByLabelText('Tanggal mulai')).toHaveValue(T);
    await userEvent.type(screen.getByLabelText('Judul'), 'Kalibrasi pH Meter');
    await userEvent.selectOptions(screen.getByLabelText('Frekuensi'), 'Weekly');
    await userEvent.selectOptions(screen.getByLabelText('Settling Pond'), 'p1');
    await userEvent.selectOptions(screen.getByLabelText('Ditugaskan ke'), 'u1');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan jadwal' }));
    await waitFor(() => expect(changes(calls)).toHaveLength(1));
    expect(changes(calls)[0]).toMatchObject({ method: 'POST', url: '/api/schedules', body: { title: 'Kalibrasi pH Meter', frequency: 'Weekly', start_date: T, sp_id: 'p1', assigned_to: 'u1' } });
    expect(await screen.findByText('Jadwal tersimpan')).toBeInTheDocument();
  });
  it('"Semua lokasi" and nobody assigned are sent as null', async () => {
    const calls = setup([]);
    renderApp('/kalender/jadwal');
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah jadwal' }));
    await userEvent.type(screen.getByLabelText('Judul'), 'Cek');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan jadwal' }));
    await waitFor(() => expect(changes(calls)).toHaveLength(1));
    expect(changes(calls)[0].body).toMatchObject({ sp_id: null, assigned_to: null });
  });
  it('a locked schedule keeps frequency and start date fixed and says why', async () => {
    const calls = setup([sch({ locked: true })]);
    renderApp('/kalender/jadwal');
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah Cek Saluran Inlet' }));
    expect(screen.getByLabelText('Frekuensi')).toBeDisabled();
    expect(screen.getByLabelText('Tanggal mulai')).toBeDisabled();
    expect(screen.getByText('Terkunci karena sudah ada catatan')).toBeInTheDocument();
    const title = screen.getByLabelText('Judul');
    await userEvent.clear(title);
    await userEvent.type(title, 'Cek Saluran Inlet 2');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan jadwal' }));
    await waitFor(() => expect(changes(calls)).toHaveLength(1));
    const c = changes(calls)[0];
    expect(c).toMatchObject({ method: 'PATCH', url: '/api/schedules/s1' });
    expect(c.body.title).toBe('Cek Saluran Inlet 2');
    expect(c.body).not.toHaveProperty('frequency');
    expect(c.body).not.toHaveProperty('start_date');
  });
  it('an unlocked schedule can change frequency', async () => {
    const calls = setup([sch()]);
    renderApp('/kalender/jadwal');
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah Cek Saluran Inlet' }));
    expect(screen.getByLabelText('Frekuensi')).toBeEnabled();
    await userEvent.selectOptions(screen.getByLabelText('Frekuensi'), 'Monthly');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan jadwal' }));
    await waitFor(() => expect(changes(calls)).toHaveLength(1));
    expect(changes(calls)[0].body.frequency).toBe('Monthly');
  });
  it('stopping asks first, and only then calls the API', async () => {
    const calls = setup([sch()]);
    renderApp('/kalender/jadwal');
    await userEvent.click(await screen.findByRole('button', { name: 'Hentikan Cek Saluran Inlet' }));
    expect(screen.getByText('Hentikan jadwal ini?')).toBeInTheDocument();
    expect(changes(calls)).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Ya, hentikan' }));
    await waitFor(() => expect(changes(calls)).toHaveLength(1));
    expect(changes(calls)[0]).toMatchObject({ method: 'POST', url: '/api/schedules/s1/stop' });
  });
  it('cancelling the confirmation changes nothing', async () => {
    const calls = setup([sch()]);
    renderApp('/kalender/jadwal');
    await userEvent.click(await screen.findByRole('button', { name: 'Hentikan Cek Saluran Inlet' }));
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.queryByText('Hentikan jadwal ini?')).toBeNull();
    expect(changes(calls)).toHaveLength(0);
  });
  it('shows the API reason when a save is refused', async () => {
    setup([sch()], (u, i) => (i?.method === 'PATCH' ? json({ error: 'Frekuensi dan tanggal mulai tidak bisa diubah karena jadwal ini sudah punya catatan.' }, 409) : undefined));
    renderApp('/kalender/jadwal');
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah Cek Saluran Inlet' }));
    await userEvent.click(screen.getByRole('button', { name: 'Simpan jadwal' }));
    expect(await screen.findByText(/tidak bisa diubah karena jadwal ini sudah punya catatan/)).toBeInTheDocument();
  });
  it('has a way back to the calendar', async () => {
    setup();
    renderApp('/kalender/jadwal');
    expect(await screen.findByRole('link', { name: 'Kembali ke Kalender' })).toHaveAttribute('href', '/kalender');
  });
});
