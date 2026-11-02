import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OutboxItem } from '../lib/outbox/db';
import { enqueue, listItems, markFailed } from '../lib/outbox/queue';

const state = { items: [] as OutboxItem[], pending: 0, failed: 0, ready: true };
vi.mock('../hooks/useOutbox', () => ({ useOutbox: () => state }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Rudi', role: 'Operator' } }) }));
const runSync = vi.fn(async () => ({ sent: 0, failed: 0, remaining: 0, paused: null }));
vi.mock('../lib/outbox/sync', () => ({ runSync: (...a: unknown[]) => runSync(...(a as [])) }));
import { SyncChip } from './SyncChip';

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  Object.assign(state, { items: [], pending: 0, failed: 0 });
  runSync.mockClear();
});

const offline = () => Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
const base = { owner: 'u1', kind: 'weather' as const, key: 'weather|2026-11-02', label: 'Cuaca 2 Nov', request: { method: 'PUT' as const, path: '/weather/2026-11-02', body: {} } };

describe('SyncChip', () => {
  it('shows nothing when online with an empty queue', () => {
    const { container } = render(<SyncChip />);
    expect(container).toBeEmptyDOMElement();
  });
  it('offline without a queue: a plain message', () => {
    offline();
    render(<SyncChip />);
    expect(screen.getByText('Tidak ada koneksi')).toBeInTheDocument();
  });
  it('offline with a queue: says how many are waiting', () => {
    offline();
    state.pending = 3;
    render(<SyncChip />);
    expect(screen.getByRole('button', { name: /Tidak ada koneksi - 3 menunggu/ })).toBeInTheDocument();
  });
  it('online with a queue: says it is uploading', () => {
    state.pending = 3;
    render(<SyncChip />);
    expect(screen.getByRole('button', { name: /Mengunggah 3/ })).toBeInTheDocument();
  });
  it('reacts to the browser going offline', () => {
    render(<SyncChip />);
    act(() => { offline(); window.dispatchEvent(new Event('offline')); });
    expect(screen.getByText('Tidak ada koneksi')).toBeInTheDocument();
  });

  it('a failed item opens the list; Coba lagi retries and syncs; Escape closes', async () => {
    const it1 = await enqueue(base);
    await markFailed(it1.id, 'Curah hujan harus berupa angka.');
    state.items = await listItems('u1');
    state.failed = 1;
    render(<SyncChip />);
    await userEvent.click(screen.getByRole('button', { name: '1 gagal' }));
    const dialog = screen.getByRole('dialog', { name: 'Antrean unggah' });
    expect(dialog).toHaveTextContent('Cuaca 2 Nov');
    expect(dialog).toHaveTextContent('Curah hujan harus berupa angka.');
    await userEvent.click(screen.getByRole('button', { name: /Coba lagi/ }));
    expect((await listItems('u1'))[0].status).toBe('pending');
    expect(runSync).toHaveBeenCalledWith('u1');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Buang asks first, naming the data, and Batal keeps it', async () => {
    const it1 = await enqueue(base);
    state.items = await listItems('u1');
    state.pending = 1;
    render(<SyncChip />);
    await userEvent.click(screen.getByRole('button', { name: /Mengunggah 1/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Buang/ }));
    expect(screen.getByText(/Cuaca 2 Nov.*hilang/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(await listItems('u1')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /^Buang/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Ya, buang' }));
    await waitFor(async () => expect(await listItems('u1')).toEqual([]));
    expect(it1.id).toBeTruthy();
  });
});
