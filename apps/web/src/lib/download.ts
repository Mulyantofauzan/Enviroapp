/** Hands a generated file to the browser's download, then frees the temporary address a second later. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function reportFilename(lokasi: string, from: string, to: string, ext: 'xlsx' | 'pdf' | 'pptx'): string {
  const place = lokasi === 'Semua pond' ? 'semua' : lokasi.replace(/[^A-Za-z0-9._-]+/g, '_');
  return `laporan-evo-${place}-${from}-${to}.${ext}`;
}
