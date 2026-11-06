import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, renderApp, emptyDay } from '../test-utils';
import { listItems } from '../lib/outbox/queue';

const offlinePut = (u: string, init?: RequestInit): Response | undefined => { if (init?.method === 'PUT') throw new TypeError('offline'); return undefined; };
const QUEUED = 'Tersimpan di HP, menunggu sinyal';

afterEach(() => vi.unstubAllGlobals());
const D = '2026-11-02';
const puts = (calls: { method: string; url: string; body: any }[]) => calls.filter((c) => c.method === 'PUT');

describe('Input Cuaca', () => {
  it('saves rainfall and rain hours with comma decimals', async () => {
    const calls = mockApi();
    renderApp(`/input/cuaca?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('Rainfall'), '12,5');
    await userEvent.type(screen.getByLabelText('Rain hours'), '3,5');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data cuaca' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0]).toMatchObject({ url: `/api/weather/${D}`, body: { rainfall_mm: 12.5, rain_hours: 3.5 } });
    expect(await screen.findByText('Data cuaca tersimpan')).toBeInTheDocument();
  });
  it('refuses to save text and says so', async () => {
    const calls = mockApi();
    renderApp(`/input/cuaca?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('Rainfall'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data cuaca' }));
    expect(await screen.findByText('Perbaiki angka yang ditandai dulu.')).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
  });
  it('hides the form while another pond is loading, so old numbers cannot go to it', async () => {
    mockApi({ handler: (u) => (u.includes('sp=p2') ? new Promise<Response>(() => {}) : undefined) });
    renderApp(`/input/cuaca?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('Rainfall'), '5');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Settling Pond' }), 'p2');
    expect(screen.queryByLabelText('Rainfall')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Simpan data cuaca' })).toBeNull();
  });
  it('a failed load shows the error and no save button', async () => {
    mockApi({ handler: (u) => (u.startsWith('/api/day') ? json({ error: 'Terjadi kesalahan. Coba lagi.' }, 500) : undefined) });
    renderApp(`/input/cuaca?date=${D}&sp=p1`);
    expect(await screen.findByRole('alert')).toHaveTextContent('Terjadi kesalahan. Coba lagi.');
    expect(screen.queryByRole('button', { name: 'Simpan data cuaca' })).toBeNull();
  });
  it('a pond that is not active opens read-only', async () => {
    mockApi();
    renderApp(`/input/cuaca?date=${D}&sp=GONE`);
    expect(await screen.findByText(/Settling pond ini nonaktif/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simpan data cuaca' })).toBeNull();
  });
  it('loads saved values for the day', async () => {
    mockApi({ handler: (u) => (u.startsWith('/api/day') ? json({ ...emptyDay, weather: { rainfall_mm: 7, rain_hours: 2 } }) : undefined) });
    renderApp(`/input/cuaca?date=${D}&sp=p1`);
    expect(await screen.findByLabelText('Rainfall')).toHaveValue('7');
  });
});

describe('Input Air Permukaan', () => {
  it('shows inlet and outlet together, with no Inlet/Outlet switcher', async () => {
    mockApi();
    renderApp(`/input/air?date=${D}&sp=p1`);
    expect(await screen.findByRole('heading', { name: /Titik Inlet/ })).toBeVisible();
    expect(screen.getByRole('heading', { name: /Titik Outlet/ })).toBeVisible();
    expect(screen.queryByRole('tab', { name: 'Inlet' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Outlet' })).toBeNull();
    expect(screen.getByLabelText('pH inlet')).toBeVisible();
    expect(screen.getByLabelText('pH outlet')).toBeVisible();
  });
  it('one save sends inlet and outlet together', async () => {
    const calls = mockApi();
    renderApp(`/input/air?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('pH inlet'), '6,8');
    await userEvent.type(screen.getByLabelText('pH outlet'), '7,1');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data air & koagulan' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0].url).toBe(`/api/water/${D}/p1`);
    expect(puts(calls)[0].body).toMatchObject({ ph_inlet: 6.8, ph_outlet: 7.1 });
    expect(await screen.findByText('Data air & koagulan tersimpan')).toBeInTheDocument();
  });
  it('flow is typed in L/s and sent to the server as m3/s', async () => {
    const calls = mockApi();
    renderApp(`/input/air?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('Debit outlet'), '14,8');
    expect(screen.queryByLabelText('Debit harian outlet')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data air & koagulan' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0].body.debit_outlet_m3s).toBe(0.0148);
  });
  it('shows a stored m3/s flow as L/s', async () => {
    mockApi({ handler: (u) => (u.startsWith('/api/day') ? json({ ...emptyDay, water: { ph_inlet: null, ph_outlet: null, tss_inlet: null, tss_outlet: null, debit_inlet_m3s: 0.5, debit_outlet_m3s: 0.25 } }) : undefined) });
    renderApp(`/input/air?date=${D}&sp=p1`);
    expect(await screen.findByLabelText('Debit outlet')).toHaveValue('250');
    expect(screen.getByLabelText('Debit inlet')).toHaveValue('500');
  });
  it('outlet pH below the pond limit is highlighted but still saves', async () => {
    const calls = mockApi();
    renderApp(`/input/air?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('pH outlet'), '5,8');
    expect(screen.getByText('Di luar baku mutu 6-9')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data air & koagulan' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0].body.ph_outlet).toBe(5.8);
  });
  it('inlet is never judged against the outlet limits', async () => {
    mockApi();
    renderApp(`/input/air?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('pH inlet'), '3');
    expect(screen.queryByText(/Di luar baku mutu/)).toBeNull();
  });
  it('text in either section blocks the save and says so', async () => {
    const calls = mockApi();
    renderApp(`/input/air?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('pH inlet'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data air & koagulan' }));
    expect(await screen.findByText('Perbaiki angka yang ditandai dulu.')).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
    expect(screen.getByText('Masukkan angka')).toBeVisible();
  });
  it('shows the abnormal-values banner', async () => {
    mockApi();
    renderApp(`/input/air?date=${D}&sp=p1`);
    expect(await screen.findByText('Nilai abnormal hanya disorot')).toBeInTheDocument();
  });
});

describe('Input Air & Koagulan: one screen', () => {
  it('shows water and coagulant sections, and one save sends both', async () => {
    const calls = mockApi();
    renderApp(`/input/air?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('pH inlet'), '7');
    await userEvent.type(screen.getByLabelText('Tawas Batu keluar'), '25');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data air & koagulan' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(2));
    expect(puts(calls).map((c) => c.url).sort()).toEqual([`/api/coagulant/${D}/p1/Tawas%20Batu`, `/api/water/${D}/p1`]);
  });
  it('coagulant only: does not create an empty water record', async () => {
    const calls = mockApi();
    renderApp(`/input/air?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('Tawas Batu keluar'), '25');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data air & koagulan' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0].url).toContain('/api/coagulant/');
  });
  it('the old koagulan address opens the combined screen with the same date and pond', async () => {
    mockApi();
    renderApp(`/input/koagulan?date=${D}&sp=p1`);
    expect(await screen.findByLabelText('Tawas Serbuk masuk')).toBeVisible();
    expect(screen.getByLabelText('pH inlet')).toBeVisible();
  });
});

describe('Input Air & Koagulan: koagulan section', () => {
  const prev = { ...emptyDay.previousRemaining, Kapur: 200 };
  const withPrev = (u: string) => (u.startsWith('/api/day') ? json({ ...emptyDay, previousRemaining: prev }) : undefined);

  it('shows starting stock and a calculated remaining', async () => {
    mockApi({ handler: withPrev });
    renderApp(`/input/air?date=${D}&sp=p1`);
    expect(await screen.findByText('Stok awal 200 kg')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Kapur masuk'), '100');
    await userEvent.type(screen.getByLabelText('Kapur keluar'), '40');
    expect(screen.getByLabelText('Kapur sisa')).toHaveValue('260');
  });
  it('warns below zero but still saves', async () => {
    const calls = mockApi({ handler: withPrev });
    renderApp(`/input/air?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('Kapur keluar'), '500');
    expect(screen.getByText('Stok di bawah nol. Periksa hitungan Anda.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data air & koagulan' }));
    await waitFor(() => expect(puts(calls).length).toBeGreaterThan(0));
  });
  it('saves only the types that were touched and sends a typed remaining', async () => {
    const calls = mockApi({ handler: withPrev });
    renderApp(`/input/air?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('Kapur masuk'), '100');
    const sisa = screen.getByLabelText('Kapur sisa');
    await userEvent.clear(sisa);
    await userEvent.type(sisa, '255');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data air & koagulan' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0].url).toBe(`/api/coagulant/${D}/p1/Kapur`);
    expect(puts(calls)[0].body).toMatchObject({ stock_in: 100, stock_remaining: 255 });
    expect(await screen.findByText('Data air & koagulan tersimpan')).toBeInTheDocument();
  });
});


describe('Input offline', () => {
  it('Cuaca: offline save is queued, says so, keeps the numbers and shows no error', async () => {
    mockApi({ handler: offlinePut });
    renderApp(`/input/cuaca?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('Rainfall'), '12,5');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data cuaca' }));
    expect(await screen.findByText(QUEUED)).toBeInTheDocument();
    expect(screen.getByLabelText('Rainfall')).toHaveValue('12,5');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(await listItems('u1')).toHaveLength(1);
  });
  it('Cuaca: reopening the screen offline shows the queued numbers again', async () => {
    mockApi({ handler: offlinePut });
    const first = renderApp(`/input/cuaca?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('Rainfall'), '12,5');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data cuaca' }));
    await screen.findByText(QUEUED);
    first.unmount();
    renderApp(`/input/cuaca?date=${D}&sp=p1`);
    await waitFor(() => expect(screen.getByLabelText('Rainfall')).toHaveValue('12,5'));
  });
  it('Air: offline save is queued', async () => {
    mockApi({ handler: offlinePut });
    renderApp(`/input/air?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('pH inlet'), '7');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data air & koagulan' }));
    expect(await screen.findByText(QUEUED)).toBeInTheDocument();
    expect((await listItems('u1'))[0].key).toBe(`water|${D}|p1`);
  });
  it('Koagulan: offline save queues one item per type that has numbers', async () => {
    mockApi({ handler: offlinePut });
    renderApp(`/input/air?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('Tawas Serbuk keluar'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data air & koagulan' }));
    expect(await screen.findByText(QUEUED)).toBeInTheDocument();
    expect((await listItems('u1')).length).toBeGreaterThanOrEqual(1);
  });
  it('a 400 from the server is shown and not queued', async () => {
    mockApi({ handler: (u, init) => (init?.method === 'PUT' ? json({ error: 'Curah hujan harus 0 atau lebih.' }, 400) : undefined) });
    renderApp(`/input/cuaca?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('Rainfall'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data cuaca' }));
    expect(await screen.findByText('Curah hujan harus 0 atau lebih.')).toBeInTheDocument();
    expect((await listItems('u1')).map((x) => `${x.key} ${x.label} ${x.recordedAt}`)).toEqual([]);
  });
});
