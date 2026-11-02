import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, renderApp } from '../test-utils';

afterEach(() => vi.unstubAllGlobals());

const T = '2026-11-04'; // a Wednesday; its week is Mon 2 to Sun 8 Nov
const ev = (over: Record<string, unknown> = {}) => ({
  schedule_id: 's1', title: 'Cek Saluran Inlet', description: null, frequency: 'Daily', sp_id: null, assigned_to_name: null,
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
  it('shows the week of today with a mark on days that have events', async () => {
    api({ week: [ev({ due_date: '2026-11-02', status: 'overdue' }), ev({ due_date: '2026-11-04' }), ev({ due_date: '2026-11-06', status: 'upcoming' })], overdue: [ev({ due_date: '2026-11-02', status: 'overdue' })] });
    renderApp('/kalender');
    expect(await screen.findByRole('button', { name: /^Sen 2, ada overdue/ })).toHaveAttribute('data-mark', 'overdue');
    expect(screen.getByRole('button', { name: /^Rab 4/ })).toHaveAttribute('data-mark', 'scheduled');
    expect(screen.getByRole('button', { name: /^Rab 4/ })).toHaveAttribute('aria-current', 'date');
    expect(screen.getByRole('button', { name: /^Jum 6/ })).toHaveAttribute('data-mark', 'scheduled');
    expect(screen.getByRole('button', { name: /^Sel 3$/ })).not.toHaveAttribute('data-mark');
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
    expect(await screen.findByText('Selesai')).toBeInTheDocument();
    expect(screen.getByText('Selesai terlambat')).toBeInTheDocument();
  });
  it('the frequency chip filters both requests', async () => {
    const urls: string[] = [];
    api({ urls });
    renderApp('/kalender');
    await screen.findByRole('tab', { name: 'Harian' });
    await userEvent.click(screen.getByRole('tab', { name: 'Harian' }));
    await screen.findByRole('tab', { name: 'Harian', selected: true });
    expect(urls.some((u) => u.startsWith('/api/events?') && u.includes('frequency=Daily'))).toBe(true);
    expect(urls.some((u) => u.startsWith('/api/events/overdue') && u.includes('frequency=Daily'))).toBe(true);
  });
  it('picking another day shows that day\'s events', async () => {
    api({ week: [ev({ due_date: T }), ev({ schedule_id: 's2', title: 'Pembersihan Pond', due_date: '2026-11-06', status: 'upcoming', frequency: 'Quarterly' })] });
    renderApp('/kalender');
    await screen.findByText('Cek Saluran Inlet');
    expect(screen.queryByText('Pembersihan Pond')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^Jum 6/ }));
    expect(await screen.findByText('Pembersihan Pond')).toBeInTheDocument();
    expect(screen.queryByText('Cek Saluran Inlet')).toBeNull();
  });
  it('next week asks for the following Monday to Sunday', async () => {
    const urls: string[] = [];
    api({ urls });
    renderApp('/kalender');
    await userEvent.click(await screen.findByRole('button', { name: 'Minggu berikutnya' }));
    await screen.findByText('9 Nov s/d 15 Nov 2026');
    expect(urls.some((u) => u.includes('from=2026-11-09') && u.includes('to=2026-11-15'))).toBe(true);
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
