import { describe, it, expect } from 'vitest';
import { addPond, call, login, json } from './helpers';

const err = async (res: Response) => ((await res.json()) as any).error as string;
const D = '2026-11-02';

describe('pesan galat Bahasa Indonesia', () => {
  it('belum masuk', async () => expect(await err(await call('/auth/me'))).toBe('Silakan masuk dulu.'));
  it('peran tak boleh menulis', async () => {
    const { cookie } = await login('Auditor');
    expect(await err(await call(`/weather/${D}`, { method: 'PUT', cookie, body: json({ rainfall_mm: 1 }) }))).toBe('Peran Anda tidak boleh mengubah data.');
  });
  it('bukan admin', async () => {
    const { cookie } = await login('Operator');
    expect(await err(await call('/users', { cookie }))).toBe('Hanya admin yang boleh melakukan ini.');
  });
  it('tanggal salah', async () => {
    const { cookie } = await login('Operator');
    expect(await err(await call('/weather/abc', { method: 'PUT', cookie, body: json({}) }))).toBe('Tanggal harus berbentuk 2026-11-02.');
  });
  it('teks di kolom angka menyebut kolomnya', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    expect(await err(await call(`/water/${D}/${sp}`, { method: 'PUT', cookie, body: json({ ph_inlet: 'abc' }) }))).toBe('pH inlet harus berupa angka.');
  });
  it('pH di luar 0-14', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    expect(await err(await call(`/water/${D}/${sp}`, { method: 'PUT', cookie, body: json({ ph_outlet: 15 }) }))).toBe('pH outlet harus antara 0 dan 14.');
  });
  it('angka negatif', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    expect(await err(await call(`/water/${D}/${sp}`, { method: 'PUT', cookie, body: json({ debit_inlet_m3s: -1 }) }))).toBe('Debit inlet harus 0 atau lebih.');
  });
  it('pond nonaktif', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond('SP 9', false);
    expect(await err(await call(`/water/${D}/${sp}`, { method: 'PUT', cookie, body: json({}) }))).toBe('Settling pond ini nonaktif. Minta admin mengaktifkannya.');
  });
  it('pond tak ada', async () => {
    const { cookie } = await login('Operator');
    expect(await err(await call(`/water/${D}/nope`, { method: 'PUT', cookie, body: json({}) }))).toBe('Pond tidak ditemukan.');
  });
  it('jenis koagulan salah', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    expect(await err(await call(`/coagulant/${D}/${sp}/Pasir`, { method: 'PUT', cookie, body: json({}) }))).toBe('Pilih Tawas Serbuk, Tawas Batu, atau Kapur.');
  });
  it('rentang riwayat salah', async () => {
    const { cookie } = await login('Operator');
    expect(await err(await call('/history?from=x&to=y', { cookie }))).toBe('Pilih rentang tanggal yang benar.');
  });
  it('pengguna: email ganda dan sandi pendek', async () => {
    const { cookie } = await login('Admin');
    const b = { name: 'Budi', email: 'budi@x.id', password: 'secret-123', role: 'Operator' };
    await call('/users', { method: 'POST', cookie, body: json(b) });
    expect(await err(await call('/users', { method: 'POST', cookie, body: json(b) }))).toBe('Email ini sudah dipakai.');
    expect(await err(await call('/users', { method: 'POST', cookie, body: json({ ...b, email: 'c@x.id', password: '123' }) }))).toBe('Kata sandi minimal 8 karakter.');
    expect(await err(await call('/users', { method: 'POST', cookie, body: json({ ...b, email: 'd@x.id', role: 'Raja' }) }))).toBe('Pilih peran yang benar.');
  });
});
