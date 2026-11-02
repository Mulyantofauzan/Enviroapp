import { describe, it, expect, vi, afterEach } from 'vitest';
import { captureStamped } from './capture';

afterEach(() => vi.restoreAllMocks());

function fakeCanvas(blob: Blob | null = new Blob(['x'], { type: 'image/jpeg' })) {
  const calls: { fillText: [string, number, number][]; fonts: string[]; rects: number[][]; toBlob?: [string, number] } = { fillText: [], fonts: [], rects: [] };
  let font = '10px sans-serif';
  const ctx = {
    drawImage: vi.fn(),
    set font(v: string) { font = v; calls.fonts.push(v); },
    get font() { return font; },
    measureText: (t: string) => ({ width: t.length * Number(/(\d+)px/.exec(font)?.[1] ?? 10) * 0.55 }),
    fillRect: (...a: number[]) => calls.rects.push(a),
    fillText: (t: string, x: number, y: number) => calls.fillText.push([t, x, y]),
    fillStyle: '', textBaseline: '',
  };
  const canvas = {
    width: 0, height: 0, getContext: () => ctx,
    toBlob: (cb: (b: Blob | null) => void, type: string, q: number) => { calls.toBlob = [type, q]; cb(blob); },
  };
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => (tag === 'canvas' ? canvas : document.createElementNS('http://www.w3.org/1999/xhtml', tag))) as any);
  return { canvas, ctx, calls };
}
const video = (w: number, h: number) => ({ videoWidth: w, videoHeight: h }) as HTMLVideoElement;
const sizeOf = (font: string) => Number(/(\d+)px/.exec(font)![1]);

describe('captureStamped', () => {
  it('shrinks so the longest side is at most 1600 px and encodes JPEG 0.85', async () => {
    const f = fakeCanvas();
    const blob = await captureStamped(video(3200, 2400), 'GPS -3.78421, 115.60214 - 2 Nov 2026 08:21 WITA');
    expect(f.canvas.width).toBe(1600);
    expect(f.canvas.height).toBe(1200);
    expect(f.calls.toBlob).toEqual(['image/jpeg', 0.85]);
    expect(blob.type).toBe('image/jpeg');
  });
  it('never enlarges a small frame', async () => {
    const f = fakeCanvas();
    await captureStamped(video(800, 600), 'x');
    expect([f.canvas.width, f.canvas.height]).toEqual([800, 600]);
  });
  it('shrinks portrait frames by their height', async () => {
    const f = fakeCanvas();
    await captureStamped(video(1200, 3000), 'x');
    expect([f.canvas.width, f.canvas.height]).toEqual([640, 1600]);
  });
  it('draws the frame, a dark bar along the bottom, and the stamp text inside the image', async () => {
    const f = fakeCanvas();
    const text = 'Tanpa lokasi - 2 Nov 2026 08:21 WITA';
    await captureStamped(video(1600, 1200), text);
    expect(f.ctx.drawImage).toHaveBeenCalled();
    expect(f.calls.fillText[0][0]).toBe(text);
    const [x, y, w, h] = f.calls.rects[0];
    expect(x).toBe(0);
    expect(w).toBe(1600);
    expect(y + h).toBe(1200);
    expect(f.calls.fillText[0][2]).toBeGreaterThan(y);
    expect(f.calls.fillText[0][2]).toBeLessThan(1200);
  });
  it('the text is larger on a wider picture and still fits inside it', async () => {
    const text = 'GPS -3.78421, 115.60214 - 2 Nov 2026 08:21 WITA';
    const wide = fakeCanvas();
    await captureStamped(video(1600, 1200), text);
    const bigFont = sizeOf(wide.calls.fonts.at(-1)!);
    const narrow = fakeCanvas();
    await captureStamped(video(400, 300), text);
    const smallFont = sizeOf(narrow.calls.fonts.at(-1)!);
    expect(bigFont).toBeGreaterThan(smallFont);
    expect(narrow.ctx.measureText(text).width).toBeLessThanOrEqual(400 - 2 * 8);
  });
  it('fails with a plain message when the browser cannot encode the picture', async () => {
    fakeCanvas(null);
    await expect(captureStamped(video(800, 600), 'x')).rejects.toThrow('Gagal membuat foto.');
  });
  it('fails with a plain message when there is no frame yet', async () => {
    fakeCanvas();
    await expect(captureStamped(video(0, 0), 'x')).rejects.toThrow('Gagal membuat foto.');
  });
});
