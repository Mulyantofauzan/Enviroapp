import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, renderApp } from '../test-utils';

vi.mock('../components/CameraCapture', () => ({
  CameraCapture: (p: any) => (
    <div role="dialog" aria-label="Kamera eviden">
      <button onClick={() => p.onUse({ blob: new Blob(['j'], { type: 'image/jpeg' }), lat: -3.78421, lng: 115.60214, accuracy: 9, takenAt: '2026-11-04T01:00:00.000Z' }).catch?.(() => {})}>Gunakan foto (uji)</button>
      <button onClick={() => p.onUse({ blob: new Blob(['j'], { type: 'image/jpeg' }), lat: null, lng: null, accuracy: null, takenAt: '2026-11-04T01:00:00.000Z' })}>Foto tanpa lokasi (uji)</button>
      <button onClick={() => p.onGallery(new File(['g'], 'dari-galeri.jpg', { type: 'image/jpeg' }))}>Galeri (uji)</button>
      <button onClick={p.onClose}>Tutup (uji)</button>
    </div>
  ),
}));

afterEach(() => vi.unstubAllGlobals());

const URL = '/kalender/s1/2026-11-03';
const base: Record<string, unknown> = {
  schedule_id: 's1', title: 'Cek Saluran Inlet', description: 'Periksa kebersihan saluran inlet.', frequency: 'Daily', sp_id: 'p1',
  assigned_to_name: null, due_date: '2026-11-03', status: 'overdue', late: false, evidence_count: 0, completed_at: null, completed_by_name: null,
};
const evid = (over: Record<string, unknown> = {}) => ({ id: 'e1', filename: 'foto.jpg', mime: 'image/jpeg', size: 2048, uploaded_at: '2026-11-03T01:00:00Z', uploaded_by_name: 'Rudi Hartono', uploaded_by: 'u1', ...over });

type S = { event?: Record<string, unknown>; evidences?: unknown[]; role?: any; status?: number; offline?: boolean };
/** Serves the detail from mutable state so a POST or DELETE changes what the next GET returns. */
function setup({ event = {}, evidences = [], role = 'Operator', offline = false }: S = {}) {
  const state = { event: { ...base, ...event }, evidences: [...evidences] as any[] };
  const calls = mockApi({
    role,
    handler: (u, i) => {
      const m = i?.method ?? 'GET';
      if (offline && m !== 'GET') throw new TypeError('offline');
      if (u === '/api/events/s1/2026-11-03' && m === 'GET') return json({ today: '2026-11-04', event: { ...state.event, evidence_count: state.evidences.length }, evidences: state.evidences });
      if (u === '/api/events/s1/2026-11-03/evidence' && m === 'POST') {
        const e = evid({ id: `e${state.evidences.length + 1}`, filename: ((i!.body as FormData).get('file') as File).name });
        state.evidences.push(e);
        return json({ id: e.id, filename: e.filename, mime: e.mime, size: e.size }, 201);
      }
      if (u.startsWith('/api/evidence/') && m === 'DELETE') { state.evidences = state.evidences.filter((x) => `/api/evidence/${x.id}` !== u); return json({ ok: true }); }
      if (u === '/api/events/s1/2026-11-03/complete' && m === 'POST') { state.event = { ...state.event, status: 'done', completed_by_name: 'Rudi Hartono', completed_at: '2026-11-04T02:00:00Z', late: true }; return json({ completed_on: '2026-11-04', late: true }); }
      return undefined;
    },
  });
  return { calls, state };
}
const pickFile = async (name = 'foto.jpg', size = 1024, type = 'image/jpeg') => {
  const input = await screen.findByLabelText('Unggah galeri');
  await userEvent.upload(input, new File([new Uint8Array(size)], name, { type }));
};

describe('EventDetail', () => {
  it('shows the event, its status and its evidence', async () => {
    setup({ evidences: [evid()] });
    renderApp(URL);
    expect(await screen.findByRole('heading', { name: 'Cek Saluran Inlet' })).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Periksa kebersihan saluran inlet.')).toBeInTheDocument();
    expect(screen.getByText(/tenggat 3 Nov/)).toBeInTheDocument();
    expect(screen.getByText('Eviden (1)')).toBeInTheDocument();
    expect(screen.getByText('foto.jpg')).toBeInTheDocument();
    expect(screen.getByText(/2 KB/)).toBeInTheDocument();
    expect(screen.getByText(/Rudi Hartono/)).toBeInTheDocument();
    expect(screen.getByText('Overdue tetap tampil')).toBeInTheDocument();
  });
  it('previews images through the protected file route, and offers a download', async () => {
    setup({ evidences: [evid(), evid({ id: 'e2', filename: 'laporan.pdf', mime: 'application/pdf' })] });
    renderApp(URL);
    const img = await screen.findByRole('img', { name: 'foto.jpg' });
    expect(img).toHaveAttribute('src', '/api/evidence/e1/file');
    expect(screen.queryByRole('img', { name: 'laporan.pdf' })).toBeNull();
    expect(screen.getAllByRole('link', { name: /Unduh/ })[1]).toHaveAttribute('href', '/api/evidence/e2/file');
  });
  it('uploads a chosen file as multipart and shows it', async () => {
    const { calls } = setup();
    renderApp(URL);
    await pickFile('baru.png', 2048, 'image/png');
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/evidence'))).toBe(true));
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/evidence'))!;
    expect(post.body.formData.file).toMatchObject({ name: 'baru.png', type: 'image/png' });
    expect(await screen.findByText('Eviden (1)')).toBeInTheDocument();
    expect(await screen.findByText('Eviden diunggah')).toBeInTheDocument();
  });
  it('a file over 10 MB is refused in the browser without calling the API', async () => {
    const { calls } = setup();
    renderApp(URL);
    await pickFile('besar.jpg', 10 * 1024 * 1024 + 1);
    expect(await screen.findByText('Berkas terlalu besar. Maksimal 10 MB.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
  it('shows the API reason when a file is refused', async () => {
    mockApi({
      handler: (u, i) => {
        if (u === '/api/events/s1/2026-11-03' && (i?.method ?? 'GET') === 'GET') return json({ today: '2026-11-04', event: base, evidences: [] });
        if (i?.method === 'POST') return json({ error: 'Jenis berkas tidak didukung. Gunakan foto atau PDF.' }, 400);
        return undefined;
      },
    });
    renderApp(URL);
    await pickFile('a.jpg');
    expect(await screen.findByText('Jenis berkas tidak didukung. Gunakan foto atau PDF.')).toBeInTheDocument();
  });
  it('Selesaikan event is off with no evidence, on with some, and finishes the event', async () => {
    const { calls } = setup();
    const { unmount } = renderApp(URL);
    expect(await screen.findByRole('button', { name: 'Selesaikan event' })).toBeDisabled();
    unmount();
    const s2 = setup({ evidences: [evid()] });
    renderApp(URL);
    const btn = await screen.findByRole('button', { name: 'Selesaikan event' });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(await screen.findByText('Event diselesaikan')).toBeInTheDocument();
    expect(s2.calls.some((c) => c.method === 'POST' && c.url.endsWith('/complete'))).toBe(true);
    expect(calls.some((c) => c.url.endsWith('/complete'))).toBe(false);
  });
  it('a finished event is read-only and says who and whether it was late', async () => {
    setup({ event: { status: 'done', late: true, completed_by_name: 'Rudi Hartono', completed_at: '2026-11-04T02:00:00Z' }, evidences: [evid()] });
    renderApp(URL);
    expect(await screen.findByText(/Diselesaikan oleh Rudi Hartono/)).toBeInTheDocument();
    expect(screen.getByText('Terlambat')).toBeInTheDocument();
    expect(screen.queryByLabelText('Unggah galeri')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Selesaikan event' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Hapus/ })).toBeNull();
  });
  it.each(['Manager', 'Auditor'] as const)('%s sees the evidence but no action buttons', async (role) => {
    setup({ role, evidences: [evid()] });
    renderApp(URL);
    expect(await screen.findByText('foto.jpg')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Unduh/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Unggah galeri')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Selesaikan event' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Hapus/ })).toBeNull();
  });
  it('an event that is not due yet offers no upload', async () => {
    setup({ event: { status: 'upcoming', due_date: '2026-11-03' } });
    renderApp(URL);
    expect(await screen.findByText('Belum waktunya')).toBeInTheDocument();
    expect(screen.queryByLabelText('Unggah galeri')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Selesaikan event' })).toBeNull();
  });
  it('deletes evidence the user uploaded, but not someone else\'s (admin can)', async () => {
    const { calls } = setup({ evidences: [evid(), evid({ id: 'e2', filename: 'orang-lain.jpg', uploaded_by: 'u9' })] });
    const { unmount } = renderApp(URL);
    expect(await screen.findByText('orang-lain.jpg')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hapus orang-lain.jpg' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Hapus foto.jpg' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url === '/api/evidence/e1')).toBe(true));
    await waitFor(() => expect(screen.queryByText('foto.jpg')).toBeNull());
    unmount();
    setup({ role: 'Admin', evidences: [evid({ id: 'e2', filename: 'orang-lain.jpg', uploaded_by: 'u9' })] });
    renderApp(URL);
    expect(await screen.findByRole('button', { name: 'Hapus orang-lain.jpg' })).toBeInTheDocument();
  });
  it('offers the camera next to the gallery, only to those who can add evidence on an open event', async () => {
    setup();
    const { unmount } = renderApp(URL);
    expect(await screen.findByRole('button', { name: 'Ambil foto' })).toBeInTheDocument();
    expect(screen.getByLabelText('Unggah galeri')).toBeInTheDocument();
    unmount();
    for (const role of ['Manager', 'Auditor'] as const) {
      setup({ role, evidences: [evid()] });
      const r = renderApp(URL);
      await screen.findByText('foto.jpg');
      expect(screen.queryByRole('button', { name: 'Ambil foto' })).toBeNull();
      r.unmount();
    }
    setup({ event: { status: 'done' } });
    renderApp(URL);
    await screen.findByRole('heading', { name: 'Cek Saluran Inlet' });
    expect(screen.queryByRole('button', { name: 'Ambil foto' })).toBeNull();
  });
  it('uploads a camera photo with its position, accuracy and time, then closes the camera', async () => {
    const { calls } = setup();
    renderApp(URL);
    await userEvent.click(await screen.findByRole('button', { name: 'Ambil foto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Gunakan foto (uji)' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/evidence'))).toBe(true));
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/evidence'))!;
    expect(post.body.formData).toMatchObject({ source: 'camera', gps_lat: '-3.78421', gps_lng: '115.60214', gps_accuracy: '9', taken_at: '2026-11-04T01:00:00.000Z' });
    expect(post.body.formData.file).toMatchObject({ type: 'image/jpeg' });
    expect(post.body.formData.file.name).toMatch(/^foto-.*\.jpg$/);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Kamera eviden' })).toBeNull());
    expect(await screen.findByText('Eviden diunggah')).toBeInTheDocument();
    expect(await screen.findByText('Eviden (1)')).toBeInTheDocument();
  });
  it('a photo with no fix is sent as a camera photo without coordinates', async () => {
    const { calls } = setup();
    renderApp(URL);
    await userEvent.click(await screen.findByRole('button', { name: 'Ambil foto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Foto tanpa lokasi (uji)' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/evidence'))).toBe(true));
    const f = calls.find((c) => c.method === 'POST' && c.url.endsWith('/evidence'))!.body.formData;
    expect(f.source).toBe('camera');
    expect(f.taken_at).toBeTruthy();
    expect(f).not.toHaveProperty('gps_lat');
    expect(f).not.toHaveProperty('gps_lng');
    expect(f).not.toHaveProperty('gps_accuracy');
  });
  it('when the server refuses a camera photo the camera stays open so it can be retried', async () => {
    mockApi({
      handler: (u, i) => {
        if (u === '/api/events/s1/2026-11-03' && (i?.method ?? 'GET') === 'GET') return json({ today: '2026-11-04', event: base, evidences: [] });
        if (i?.method === 'POST') return json({ error: 'Waktu foto tidak boleh di masa depan.' }, 400);
        return undefined;
      },
    });
    renderApp(URL);
    await userEvent.click(await screen.findByRole('button', { name: 'Ambil foto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Gunakan foto (uji)' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Kamera eviden' })).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole('dialog', { name: 'Kamera eviden' })).toBeInTheDocument();
  });
  it('a file chosen inside the camera dialog goes up as a gallery file and closes the camera', async () => {
    const { calls } = setup();
    renderApp(URL);
    await userEvent.click(await screen.findByRole('button', { name: 'Ambil foto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Galeri (uji)' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/evidence'))).toBe(true));
    const f = calls.find((c) => c.method === 'POST' && c.url.endsWith('/evidence'))!.body.formData;
    expect(f.source).toBe('gallery');
    expect(f).not.toHaveProperty('gps_lat');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Kamera eviden' })).toBeNull());
  });
  it('closing the camera without a photo uploads nothing', async () => {
    const { calls } = setup();
    renderApp(URL);
    await userEvent.click(await screen.findByRole('button', { name: 'Ambil foto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tutup (uji)' }));
    expect(screen.queryByRole('dialog', { name: 'Kamera eviden' })).toBeNull();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
  it('the gallery button sends source=gallery', async () => {
    const { calls } = setup();
    renderApp(URL);
    await pickFile('baru.png', 2048, 'image/png');
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/evidence'))).toBe(true));
    expect(calls.find((c) => c.method === 'POST' && c.url.endsWith('/evidence'))!.body.formData.source).toBe('gallery');
  });
  it('each evidence row says where it came from: coordinates, "Tanpa lokasi" or "Galeri"', async () => {
    setup({ evidences: [
      evid({ id: 'a', filename: 'kamera.jpg', source: 'camera', gps_lat: -3.78421, gps_lng: 115.60214 }),
      evid({ id: 'b', filename: 'gelap.jpg', source: 'camera', gps_lat: null, gps_lng: null }),
      evid({ id: 'c', filename: 'lama.jpg', source: 'gallery' }),
    ] });
    renderApp(URL);
    expect(await screen.findByText('GPS -3.78421, 115.60214')).toBeInTheDocument();
    expect(screen.getByText('Tanpa lokasi')).toBeInTheDocument();
    expect(screen.getByText('Galeri')).toBeInTheDocument();
  });
  it('tapping a picture opens the big preview, Escape closes it and focus goes back to the picture', async () => {
    setup({ evidences: [evid({ source: 'camera', gps_lat: -3.78421, gps_lng: 115.60214, taken_at: '2026-11-03T00:21:00.000Z' })] });
    renderApp(URL);
    const thumb = await screen.findByRole('button', { name: 'Lihat foto.jpg' });
    await userEvent.click(thumb);
    const dlg = await screen.findByRole('dialog', { name: 'Pratinjau eviden' });
    expect(dlg).toHaveTextContent('Cek Saluran Inlet');
    expect(dlg).toHaveTextContent('GPS -3.78421, 115.60214');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Pratinjau eviden' })).toBeNull();
    expect(thumb).toHaveFocus();
  });
  it('a PDF has no preview dialog, only the download link', async () => {
    setup({ evidences: [evid({ id: 'p', filename: 'laporan.pdf', mime: 'application/pdf' })] });
    renderApp(URL);
    expect(await screen.findByText('laporan.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lihat laporan.pdf' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Unduh laporan.pdf' })).toBeInTheDocument();
  });
  it('an unknown event says so and links back to the calendar', async () => {
    mockApi({ handler: (u) => (u.startsWith('/api/events/s1/') ? json({ error: 'Event tidak ditemukan.' }, 404) : undefined) });
    renderApp(URL);
    expect(await screen.findByText('Event tidak ditemukan.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kembali ke Kalender' })).toHaveAttribute('href', '/kalender');
  });
  it('has a way back to the calendar', async () => {
    setup();
    renderApp(URL);
    expect(await screen.findByRole('link', { name: 'Kembali ke Kalender' })).toBeInTheDocument();
  });
});


describe('EventDetail offline', () => {
  const QUEUED_PHOTO = 'Foto tersimpan di HP, menunggu sinyal';

  it('a chosen file is queued: toast, a "Menunggu unggah" row, nothing lost', async () => {
    setup({ offline: true });
    renderApp(URL);
    await pickFile('laporan.jpg');
    expect(await screen.findByText(QUEUED_PHOTO)).toBeInTheDocument();
    expect(await screen.findByText('laporan.jpg')).toBeInTheDocument();
    expect(await screen.findByText('Menunggu unggah')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Selesaikan event is enabled with only a queued photo and queues the completion', async () => {
    setup({ offline: true });
    renderApp(URL);
    await pickFile('laporan.jpg');
    await screen.findByText(QUEUED_PHOTO);
    const done = screen.getByRole('button', { name: 'Selesaikan event' });
    await waitFor(() => expect(done).toBeEnabled());
    await userEvent.click(done);
    expect(await screen.findByText('Penyelesaian tersimpan di HP, menunggu sinyal')).toBeInTheDocument();
    expect(screen.getByText(/Penyelesaian menunggu unggah/)).toBeInTheDocument();
  });

  it('a camera photo taken offline closes the camera and is queued', async () => {
    setup({ offline: true });
    renderApp(URL);
    await userEvent.click(await screen.findByRole('button', { name: /Ambil foto/ }));
    await userEvent.click(screen.getByText('Gunakan foto (uji)'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Kamera eviden' })).toBeNull());
    expect(await screen.findByText(QUEUED_PHOTO)).toBeInTheDocument();
  });

  it('reloads the event after the queue has been uploaded', async () => {
    const { calls } = setup();
    renderApp(URL);
    await screen.findByRole('heading', { name: 'Cek Saluran Inlet' });
    const before = calls.filter((c) => c.url === '/api/events/s1/2026-11-03').length;
    window.dispatchEvent(new Event('outbox:drained'));
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/events/s1/2026-11-03').length).toBe(before + 1));
  });
});
