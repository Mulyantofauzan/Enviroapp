import { describe, it, expect, vi, afterEach } from 'vitest';
import { serializeChart, svgToPng, chartToPng } from './chartImage';

afterEach(() => vi.unstubAllGlobals());

const svgOf = (html: string) => {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host.querySelector('svg') as SVGSVGElement;
};

describe('serializeChart', () => {
  const svg = () => svgOf('<svg viewBox="0 0 340 220"><path class="ui-chart__outlet" d="M0 0L10 10"/><text class="ui-chart__label" x="1" y="2">38</text></svg>');
  const fake = (el: Element) => {
    const cls = el.getAttribute('class') ?? '';
    const map: Record<string, string> = cls.includes('outlet') ? { stroke: 'rgb(14, 124, 102)', 'stroke-width': '2.5px', fill: 'none' } : cls.includes('label') ? { fill: 'rgb(16, 22, 20)', 'font-size': '11px', 'font-weight': '600' } : {};
    return { getPropertyValue: (p: string) => map[p] ?? '' } as unknown as CSSStyleDeclaration;
  };
  it('is a standalone, well-formed svg with a namespace and a pixel size from the viewBox', () => {
    const out = serializeChart(svg(), fake);
    expect(out.width).toBe(340);
    expect(out.height).toBe(220);
    const doc = new DOMParser().parseFromString(out.xml, 'image/svg+xml');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.documentElement.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
    expect(doc.documentElement.getAttribute('width')).toBe('340');
  });
  it('bakes the resolved colors into the elements, since the page stylesheet will not follow it', () => {
    const doc = new DOMParser().parseFromString(serializeChart(svg(), fake).xml, 'image/svg+xml');
    const path = doc.getElementsByTagName('path')[0];
    expect(path.getAttribute('stroke')).toBe('rgb(14, 124, 102)');
    expect(path.getAttribute('stroke-width')).toBe('2.5px');
    const text = doc.getElementsByTagName('text')[0];
    expect(text.getAttribute('fill')).toBe('rgb(16, 22, 20)');
    expect(text.getAttribute('font-size')).toBe('11px');
  });
  it('does not touch the original element', () => {
    const el = svg();
    serializeChart(el, fake);
    expect(el.querySelector('path')!.getAttribute('stroke')).toBeNull();
  });
});

describe('svgToPng', () => {
  it('rasterizes an already-serialized snapshot, independent of the page', async () => {
    class FakeImage { onload: (() => void) | null = null; onerror: (() => void) | null = null; set src(_v: string) { queueMicrotask(() => this.onload?.()); } }
    vi.stubGlobal('Image', FakeImage);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), fillRect: vi.fn(), set fillStyle(_v: string) {} } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,BBBB');
    expect(await svgToPng({ xml: '<svg xmlns="http://www.w3.org/2000/svg"/>', width: 100, height: 50 })).toEqual({ dataUrl: 'data:image/png;base64,BBBB', width: 100, height: 50 });
  });
});

describe('chartToPng', () => {
  function stubBrowser(fail = false) {
    class FakeImage {
      onload: (() => void) | null = null; onerror: (() => void) | null = null; width = 0; height = 0;
      set src(_v: string) { queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.())); }
    }
    vi.stubGlobal('Image', FakeImage);
    const draw = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: draw, fillRect: vi.fn(), scale: vi.fn(), set fillStyle(_v: string) {} } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
    return draw;
  }
  it('draws the svg on a canvas twice the size and returns a PNG data URL', async () => {
    const draw = stubBrowser();
    const el = svgOf('<svg viewBox="0 0 340 220"></svg>');
    const out = await chartToPng(el);
    expect(out).toEqual({ dataUrl: 'data:image/png;base64,AAAA', width: 340, height: 220 });
    expect(draw).toHaveBeenCalled();
  });
  it('rejects when the image cannot be loaded', async () => {
    stubBrowser(true);
    await expect(chartToPng(svgOf('<svg viewBox="0 0 10 10"></svg>'))).rejects.toThrow('Grafik tidak bisa dibuat menjadi gambar.');
  });
});
