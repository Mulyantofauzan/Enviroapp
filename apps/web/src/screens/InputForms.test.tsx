import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, renderApp, emptyDay } from '../test-utils';

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
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data air' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0].url).toBe(`/api/water/${D}/p1`);
    expect(puts(calls)[0].body).toMatchObject({ ph_inlet: 6.8, ph_outlet: 7.1 });
    expect(await screen.findByText('Data air tersimpan')).toBeInTheDocument();
  });
  it('daily flow is calculated from m3/s', async () => {
    mockApi();
    renderApp(`/input/air?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('Debit outlet per detik'), '0,0148');
    expect(screen.getByLabelText('Debit harian outlet')).toHaveValue('1.278,7');
  });
  it('outlet pH below the pond limit is highlighted but still saves', async () => {
    const calls = mockApi();
    renderApp(`/input/air?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('pH outlet'), '5,8');
    expect(screen.getByText('Di luar baku mutu 6-9')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data air' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data air' }));
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

describe('Input Koagulan', () => {
  const prev = { ...emptyDay.previousRemaining, Kapur: 200 };
  const withPrev = (u: string) => (u.startsWith('/api/day') ? json({ ...emptyDay, previousRemaining: prev }) : undefined);

  it('shows starting stock and a calculated remaining', async () => {
    mockApi({ handler: withPrev });
    renderApp(`/input/koagulan?date=${D}&sp=p1`);
    expect(await screen.findByText('Stok awal 200 kg')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Kapur masuk'), '100');
    await userEvent.type(screen.getByLabelText('Kapur keluar'), '40');
    expect(screen.getByLabelText('Kapur sisa')).toHaveValue('260');
  });
  it('warns below zero but still saves', async () => {
    const calls = mockApi({ handler: withPrev });
    renderApp(`/input/koagulan?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('Kapur keluar'), '500');
    expect(screen.getByText('Stok di bawah nol. Periksa hitungan Anda.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data koagulan' }));
    await waitFor(() => expect(puts(calls).length).toBeGreaterThan(0));
  });
  it('saves only the types that were touched and sends a typed remaining', async () => {
    const calls = mockApi({ handler: withPrev });
    renderApp(`/input/koagulan?date=${D}&sp=p1`);
    await userEvent.type(await screen.findByLabelText('Kapur masuk'), '100');
    const sisa = screen.getByLabelText('Kapur sisa');
    await userEvent.clear(sisa);
    await userEvent.type(sisa, '255');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan data koagulan' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0].url).toBe(`/api/coagulant/${D}/p1/Kapur`);
    expect(puts(calls)[0].body).toMatchObject({ stock_in: 100, stock_remaining: 255 });
    expect(await screen.findByText('Data koagulan tersimpan')).toBeInTheDocument();
  });
});
