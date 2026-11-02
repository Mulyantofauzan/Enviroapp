import { describe, it, expect, vi, afterEach } from 'vitest';
import { svgToPng } from './chartImage';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function stubBrowser(fail = false) {
  class FakeImage {
    onload: (() => void) | null = null; onerror: (() => void) | null = null;
    set src(_v: string) { queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.())); }
  }
  vi.stubGlobal('Image', FakeImage);
  const draw = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: draw, fillRect: vi.fn(), set fillStyle(_v: string) {} } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,BBBB');
  return draw;
}

describe('svgToPng', () => {
  it('draws the svg on a canvas and returns a PNG data URL with the source size', async () => {
    const draw = stubBrowser();
    expect(await svgToPng({ xml: '<svg xmlns="http://www.w3.org/2000/svg"/>', width: 100, height: 50 })).toEqual({ dataUrl: 'data:image/png;base64,BBBB', width: 100, height: 50 });
    expect(draw).toHaveBeenCalled();
  });
  it('scales the canvas by the factor given', async () => {
    stubBrowser();
    const sizes: number[] = [];
    const orig = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = orig(tag);
      if (tag === 'canvas') queueMicrotask(() => sizes.push((el as HTMLCanvasElement).width));
      return el;
    });
    await svgToPng({ xml: '<svg xmlns="http://www.w3.org/2000/svg"/>', width: 100, height: 50 }, 3);
    expect(sizes).toEqual([300]);
  });
  it('rejects with a message when the image cannot be loaded', async () => {
    stubBrowser(true);
    await expect(svgToPng({ xml: '<svg/>', width: 10, height: 10 })).rejects.toThrow('Grafik tidak bisa dibuat menjadi gambar.');
  });
});
