import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, renderApp } from '../test-utils';

afterEach(() => vi.unstubAllGlobals());

const T = '2026-11-04'; // a Wednesday in November 2026
const ev = (over: Record<string, unknown> = {}) => ({
  schedule_id: 's1', title: 'Cek Saluran Inlet', description: null, frequency: 'Daily', category_id: null, category_name: null, category_color: null, assigned_to_name: null,
  due_date: T, status: 'today', late: false, evidence_count: 0, completed_at: null, completed_by_name: null, ...over,
});

type Setup = { week?: unknown[]; overdue?: unknown[]; total?: number; urls?: string[]; role?: any; fail?: boolean };
function api({ week = [], overdue = [], total, urls = [], role = 'Operator', fail }: Setup = {}) {
  return mockApi({
    role,
    handler: (u) => {
      urls.push(u);
      if (u.startsWith('/api/events/summary')) return json({ today: T, overdue: overdue.length, due_today: 1 });
      if (fail && u.startsWith('/api/events')) return json({ error: 'Terjadi kesalahan. Coba lagi.' }, 500);
      if (u.startsWith('/api/events/overdue')) return json({ today: T, total: total ?? overdue.length, events: overdue });
      if (u.startsWith('/api/events?')) return json({ today: T, events: week });
      return undefined;
    },
  });
}

describe('Kalender', () => {
  const AIR = { category_id: 'k1', category_name: 'Air', category_color: '#2E7D32' };
  const UDARA = { category_id: 'k2', category_name: 'Udara', category_color: '#1565C0' };
  it('shows the whole month of today, with a dot for each category of event on a day', async () => {
    api({
      week: [
        ev({ due_date: '2026-11-02', status: 'overdue', ...AIR }), ev({ due_date: '2026-11-04' }), ev({ due_date: '2026-11-05', status: 'done', ...UDARA }),
        ev({ due_date: '2026-11-20', status: 'upcoming', ...AIR }), ev({ schedule_id: 's2', due_date: '2026-11-20', status: 'done', ...UDARA }),
      ],
      overdue: [ev({ due_date: '2026-11-02', status: 'overdue', ...AIR })],
    });
    renderApp('/kalender');
    expect(await screen.findByText('November 2026')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^\d+ November/ })).toHaveLength(30);
    expect(await screen.findByRole('button', { name: '2 November, Air' })).toHaveAttribute('data-marks', 'k1');
    expect(screen.getByRole('button', { name: /^4 November/ })).toHaveAttribute('aria-current', 'date');
    expect(screen.getByRole('button', { name: '4 November, Tanpa kategori' })).toHaveAttribute('data-marks', 'none');
    expect(screen.getByRole('button', { name: '5 November, Udara' })).toHaveAttribute('data-marks', 'k2');
    expect(screen.getByRole('button', { name: '20 November, Air, Udara' })).toHaveAttribute('data-marks', 'k1 k2');
    expect(screen.getByRole('button', { name: '3 November' })).not.toHaveAttribute('data-marks');
    const legend = screen.getByRole('list', { name: 'Kategori' });
    expect(within(legend).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Air', 'Udara', 'Tanpa kategori']);
  });
  it('an event card names its category', async () => {
    api({ week: [ev({ ...AIR })] });
    renderApp('/kalender');
    const card = await screen.findByRole('article', { name: 'Cek Saluran Inlet' });
    expect(within(card).getByText('Air')).toBeInTheDocument();
  });
  it('overdue cards come first, with a way to upload for operators', async () => {
    api({ overdue: [ev({ due_date: '2026-11-03', status: 'overdue' })], week: [ev({ due_date: T, title: 'Kalibrasi pH Meter', frequency: 'Weekly' })] });
    renderApp('/kalender');
    const card = await screen.findByRole('article', { name: /Cek Saluran Inlet/ });
    expect(within(card).getByText('Overdue')).toBeInTheDocument();
    expect(within(card).getByText(/Harian/)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Unggah eviden' })).toHaveAttribute('href', '/kalender/s1/2026-11-03');
    const today = await screen.findByRole('article', { name: /Kalibrasi pH Meter/ });
    expect(within(today).getByText('Hari ini')).toBeInTheDocument();
    expect(card.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it.each(['Manager', 'Auditor'] as const)('%s can open an event but sees no upload action', async (role) => {
    api({ role, overdue: [ev({ due_date: '2026-11-03', status: 'overdue' })] });
    renderApp('/kalender');
    const card = await screen.findByRole('article', { name: /Cek Saluran Inlet/ });
    expect(within(card).queryByRole('link', { name: 'Unggah eviden' })).toBeNull();
    expect(within(card).getByRole('link', { name: 'Cek Saluran Inlet' })).toHaveAttribute('href', '/kalender/s1/2026-11-03');
  });
  it('a finished event shows Selesai, or Selesai terlambat', async () => {
    api({ week: [ev({ status: 'done' }), ev({ schedule_id: 's2', title: 'Uji Air', status: 'done', late: true })] });
    renderApp('/kalender');
    const onTime = await screen.findByRole('article', { name: 'Cek Saluran Inlet' });
    expect(within(onTime).getByText('Selesai')).toBeInTheDocument();
    const late = screen.getByRole('article', { name: 'Uji Air' });
    expect(within(late).getByText('Selesai terlambat')).toBeInTheDocument();
  });
  it('the frequency chip filters both requests', async () => {
    const urls: string[] = [];
    api({ urls });
    renderApp('/kalender');
    await screen.findByRole('tab', { name: 'Harian' });
    await userEvent.click(screen.getByRole('tab', { name: 'Harian' }));
    await screen.findByRole('tab', { name: 'Harian', selected: true });
    expect(urls.some((u) => u.startsWith('/api/events?') && u.includes('frequency=Daily') && u.includes('from=2026-11-01') && u.includes('to=2026-11-30'))).toBe(true);
    expect(urls.some((u) => u.startsWith('/api/events/overdue') && u.includes('frequency=Daily'))).toBe(true);
  });
  it('picking another day shows that day\'s events', async () => {
    api({ week: [ev({ due_date: T }), ev({ schedule_id: 's2', title: 'Pembersihan Pond', due_date: '2026-11-20', status: 'upcoming', frequency: 'Quarterly' })] });
    renderApp('/kalender');
    await screen.findByText('Cek Saluran Inlet');
    expect(screen.queryByText('Pembersihan Pond')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^20 November/ }));
    expect(await screen.findByText('Pembersihan Pond')).toBeInTheDocument();
    expect(screen.queryByText('Cek Saluran Inlet')).toBeNull();
  });
  it('next month asks for the whole of December and shows its days', async () => {
    const urls: string[] = [];
    api({ urls });
    renderApp('/kalender');
    await userEvent.click(await screen.findByRole('button', { name: 'Bulan berikutnya' }));
    expect(await screen.findByText('Desember 2026')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^\d+ Desember/ })).toHaveLength(31);
    expect(urls.some((u) => u.includes('from=2026-12-01') && u.includes('to=2026-12-31'))).toBe(true);
  });
  it('previous month goes back, and a month that is not today\'s starts on its first day', async () => {
    api();
    renderApp('/kalender');
    await userEvent.click(await screen.findByRole('button', { name: 'Bulan sebelumnya' }));
    expect(await screen.findByText('Oktober 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^1 Oktober/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Kamis, 1 Okt 2026' })).toBeInTheDocument();
  });
  it('coming back to the current month selects today again', async () => {
    api();
    renderApp('/kalender');
    await userEvent.click(await screen.findByRole('button', { name: 'Bulan berikutnya' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Bulan sebelumnya' }));
    expect(await screen.findByRole('button', { name: /^4 November/ })).toHaveAttribute('aria-pressed', 'true');
  });
  it('says so when the day has nothing', async () => {
    api();
    renderApp('/kalender');
    expect(await screen.findByText('Tidak ada event pada tanggal ini.')).toBeInTheDocument();
  });
  it('is honest when overdue is longer than what is shown', async () => {
    api({ overdue: [ev({ due_date: '2026-11-03', status: 'overdue' })], total: 250 });
    renderApp('/kalender');
    expect(await screen.findByText('Ada 250 event overdue, 1 teratas ditampilkan.')).toBeInTheDocument();
  });
  it('a failure is shown as an alert', async () => {
    api({ fail: true });
    renderApp('/kalender');
    expect(await screen.findByRole('alert')).toHaveTextContent('Terjadi kesalahan. Coba lagi.');
  });
  it('Atur jadwal is for Manager and Admin only', async () => {
    api({ role: 'Manager' });
    const { unmount } = renderApp('/kalender');
    expect(await screen.findByRole('link', { name: 'Atur jadwal' })).toHaveAttribute('href', '/kalender/jadwal');
    unmount();
    api({ role: 'Operator' });
    renderApp('/kalender');
    await screen.findByRole('tab', { name: 'Harian' });
    expect(screen.queryByRole('link', { name: 'Atur jadwal' })).toBeNull();
  });
});
