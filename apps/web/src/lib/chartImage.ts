/** Style properties copied onto each element: a standalone svg cannot see the page stylesheet or its variables. */
const PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-linejoin', 'stroke-linecap', 'stroke-dasharray', 'opacity', 'font-family', 'font-size', 'font-weight', 'paint-order', 'text-anchor'];
const SVG_NS = 'http://www.w3.org/2000/svg';

type StyleOf = (el: Element) => Pick<CSSStyleDeclaration, 'getPropertyValue'>;

export function serializeChart(svg: SVGSVGElement, styleOf: StyleOf = (el) => getComputedStyle(el)): { xml: string; width: number; height: number } {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...Array.from(svg.querySelectorAll('*'))];
  const to = [clone, ...Array.from(clone.querySelectorAll('*'))];
  from.forEach((el, i) => {
    if (el.tagName.toLowerCase() === 'svg' || el.tagName.toLowerCase() === 'g') return;
    const cs = styleOf(el);
    for (const p of PROPS) {
      const v = cs.getPropertyValue(p);
      if (v) to[i].setAttribute(p, v);
    }
  });
  const [, , w, h] = (svg.getAttribute('viewBox') ?? '0 0 340 220').split(/\s+/).map(Number);
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  let xml = new XMLSerializer().serializeToString(clone);
  if (!xml.includes(`xmlns="${SVG_NS}"`)) xml = xml.replace('<svg', `<svg xmlns="${SVG_NS}"`);
  return { xml, width: w, height: h };
}

export type SerializedChart = { xml: string; width: number; height: number };

/** Draws a serialized chart on a white canvas at `scale` times its size and returns it as a PNG data URL. */
export function svgToPng({ xml, width, height }: SerializedChart, scale = 2): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no canvas');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ dataUrl: canvas.toDataURL('image/png'), width, height });
      } catch {
        reject(new Error('Grafik tidak bisa dibuat menjadi gambar.'));
      }
    };
    img.onerror = () => reject(new Error('Grafik tidak bisa dibuat menjadi gambar.'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  });
}

export const chartToPng = (svg: SVGSVGElement, scale = 2) => svgToPng(serializeChart(svg), scale);
