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

