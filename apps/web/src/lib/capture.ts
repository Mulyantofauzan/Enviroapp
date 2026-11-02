const FAIL = 'Gagal membuat foto.';

/**
 * Draws the current video frame, shrinks it to at most `maxSide` on the long edge, burns the stamp into a
 * dark bar along the bottom, and encodes JPEG. The stamp is part of the picture, not a separate label.
 */
export function captureStamped(video: HTMLVideoElement, text: string, maxSide = 1600): Promise<Blob> {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return Promise.reject(new Error(FAIL));
  const scale = Math.min(1, maxSide / Math.max(vw, vh));
  const w = Math.round(vw * scale), h = Math.round(vh * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error(FAIL));
  ctx.drawImage(video, 0, 0, w, h);

  const pad = Math.max(8, Math.round(w * 0.015));
  let size = Math.max(12, Math.round(w * 0.032));
  const setFont = () => { ctx.font = `600 ${size}px Inter, system-ui, sans-serif`; };
  setFont();
  while (size > 8 && ctx.measureText(text).width > w - 2 * pad) { size -= 1; setFont(); }
  const bar = Math.round(size * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, h - bar, w, bar);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pad, h - bar / 2);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(FAIL))), 'image/jpeg', 0.85);
  });
}
