import { describe, it, expect, vi, afterEach } from 'vitest';
import { reportFilename, saveBlob } from './download';

afterEach(() => vi.restoreAllMocks());

describe('reportFilename', () => {
  it('cleans the location and keeps the range and extension', () => {
    expect(reportFilename('SP-02 Pit Selatan', '2026-10-27', '2026-11-02', 'xlsx')).toBe('laporan-evo-SP-02_Pit_Selatan-2026-10-27-2026-11-02.xlsx');
    expect(reportFilename('A/B "x"', '2026-10-27', '2026-11-02', 'pdf')).toBe('laporan-evo-A_B_x_-2026-10-27-2026-11-02.pdf');
  });
  it('all locations is "semua"', () => {
    expect(reportFilename('Semua lokasi', '2026-10-27', '2026-11-02', 'pdf')).toBe('laporan-evo-semua-2026-10-27-2026-11-02.pdf');
  });
});

describe('saveBlob', () => {
  it('clicks an anchor with the file name and releases the object URL later', () => {
    vi.useFakeTimers();
    const names: string[] = [];
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
    saveBlob(new Blob(['x']), 'a.xlsx');
    expect(names).toEqual(['a.xlsx']);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1100);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    vi.useRealTimers();
  });
});
