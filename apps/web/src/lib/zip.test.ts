import { describe, it, expect, vi } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { safeEntryName, buildZip } from './zip';

const it1 = (o: Partial<{ id: string; due_date: string; title: string; filename: string }> = {}) => ({ id: 'a', due_date: '2026-11-02', title: 'Cek pompa', filename: 'foto.jpg', ...o });

const readBlob = (b: Blob) => new Promise<Uint8Array>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(new Uint8Array(r.result as ArrayBuffer));
  r.onerror = () => rej(r.error);
  r.readAsArrayBuffer(b);
});

describe('safeEntryName', () => {
  it('keeps date, title, number and file name', () => {
    expect(safeEntryName(it1(), 1)).toBe('2026-11-02_Cek_pompa_1_foto.jpg');
  });
  it('removes slashes, backslashes, dots-dots, quotes, double spaces and non-ASCII', () => {
    const n = safeEntryName(it1({ title: 'A/B\\C "D"  E ../ Café', filename: '../../etc/pa"ss.jpg' }), 2);
    expect(n).not.toMatch(/[/\\"]/);
    expect(n).not.toContain('..');
    expect(n).not.toContain('  ');
    expect(n).toMatch(/^[A-Za-z0-9._-]+$/);
  });
  it('is at most 120 characters and still ends with the file name tail and number', () => {
    const n = safeEntryName(it1({ title: 'x'.repeat(300), filename: 'a.jpg' }), 7);
    expect(n.length).toBeLessThanOrEqual(120);
    expect(n.endsWith('_7_a.jpg')).toBe(true);
  });
  it('two files with the same name still differ', () => {
    expect(safeEntryName(it1(), 1)).not.toBe(safeEntryName(it1(), 2));
  });
});

describe('buildZip', () => {
  const items = [it1({ id: 'a', filename: 'x.jpg' }), it1({ id: 'b', filename: 'x.jpg' }), it1({ id: 'c', filename: 'y.pdf' })];
  const bytes = (id: string) => new Uint8Array([id.charCodeAt(0), 1, 2, 3]);

  it('zips every file with exact content and unique names', async () => {
    const blob = await buildZip(items, async (id) => bytes(id), () => {});
    const out = unzipSync(await readBlob(blob));
    const names = Object.keys(out);
    expect(names.length).toBe(3);
    expect(new Set(names).size).toBe(3);
    expect(out[names[0]]).toEqual(bytes('a'));
    expect(out[names[2]]).toEqual(bytes('c'));
    expect(strFromU8(new Uint8Array([104, 105]))).toBe('hi');
  });
  it('reports progress one file at a time', async () => {
    const seen: [number, number][] = [];
    await buildZip(items, async (id) => bytes(id), (d, t) => seen.push([d, t]));
    expect(seen).toEqual([[1, 3], [2, 3], [3, 3]]);
  });
  it('fetches in order, not in parallel', async () => {
    let running = 0, peak = 0;
    await buildZip(items, async (id) => { running++; peak = Math.max(peak, running); await Promise.resolve(); running--; return bytes(id); }, () => {});
    expect(peak).toBe(1);
  });
  it('rejects naming the file when one fetch fails, with no blob', async () => {
    const fetchFile = vi.fn(async (id: string) => { if (id === 'b') throw new Error('boom'); return bytes(id); });
    await expect(buildZip(items, fetchFile, () => {})).rejects.toThrow(/x\.jpg/);
    expect(fetchFile).toHaveBeenCalledTimes(2);
  });
  it('rejects an empty list', async () => {
    await expect(buildZip([], async () => new Uint8Array(), () => {})).rejects.toThrow();
  });
});
