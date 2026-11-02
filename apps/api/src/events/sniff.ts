export type EvidenceMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'application/pdf';

const ascii = (b: Uint8Array, from: number, len: number) => String.fromCharCode(...b.slice(from, from + len));
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'];

/** The type comes from the file's own bytes, never from the name or the type the client claims. */
export function sniffMime(b: Uint8Array): EvidenceMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image/webp';
  if (b.length >= 4 && ascii(b, 0, 4) === '%PDF') return 'application/pdf';
  if (b.length >= 12 && ascii(b, 4, 4) === 'ftyp' && HEIC_BRANDS.includes(ascii(b, 8, 4))) return 'image/heic';
  return null;
}

/** Keeps only a plain file name: no folders, quotes, or control characters. */
export function safeFilename(name: string): string {
  const last = name.split(/[\\/]/).pop() ?? '';
  const clean = last.replace(/[\u0000-\u001f\u007f"]/g, '').trim().slice(0, 100);
  return clean === '' || clean === '.' || clean === '..' ? 'berkas' : clean;
}
