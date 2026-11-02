import { zipSync } from 'fflate';

export type ZipItem = { id: string; due_date: string; title: string; filename: string };

const MAX_NAME = 120;
const clean = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/\.{2,}/g, '_');

/** `{date}_{title}_{n}_{file}`: only letters, digits, dot, minus, underscore. The number keeps equal names apart. */
export function safeEntryName(item: Pick<ZipItem, 'due_date' | 'title' | 'filename'>, n: number): string {
  const head = `${clean(item.due_date)}_${clean(item.title)}`;
  let file = clean(item.filename);
  let tail = `_${n}_${file}`;
  if (tail.length > MAX_NAME - 10) {
    const dot = file.lastIndexOf('.');
    const ext = dot > 0 && file.length - dot <= 8 ? file.slice(dot) : '';
    file = file.slice(0, Math.max(1, MAX_NAME - 10 - `_${n}_`.length - ext.length)) + ext;
    tail = `_${n}_${file}`;
  }
  return head.slice(0, Math.max(0, MAX_NAME - tail.length)) + tail;
}

/** Fetches one file at a time. If any fails, nothing is returned: no half-finished archive. */
export async function buildZip(
  items: ZipItem[],
  fetchFile: (id: string) => Promise<Uint8Array>,
  onProgress: (done: number, total: number) => void,
): Promise<Blob> {
  if (items.length === 0) throw new Error('Tidak ada eviden untuk diunduh.');
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    try {
      files[safeEntryName(it, i + 1)] = await fetchFile(it.id);
    } catch {
      throw new Error(`Gagal mengambil ${it.filename}. ZIP dibatalkan.`);
    }
    onProgress(i + 1, items.length);
  }
  return new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
}
