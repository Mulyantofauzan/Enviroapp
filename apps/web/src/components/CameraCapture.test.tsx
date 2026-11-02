import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../lib/capture', () => ({ captureStamped: vi.fn() }));
import { captureStamped } from '../lib/capture';
import { CameraCapture } from './CameraCapture';

type Track = { stop: ReturnType<typeof vi.fn> };
const makeStream = () => { const tracks: Track[] = [{ stop: vi.fn() }]; return { tracks, stream: { getTracks: () => tracks } as unknown as MediaStream }; };

let gum: ReturnType<typeof vi.fn>;
let geo: { ok: ((p: any) => void) | null; err: ((e: any) => void) | null; clear: ReturnType<typeof vi.fn> };
const setSecure = (v: boolean) => Object.defineProperty(window, 'isSecureContext', { value: v, configurable: true });

beforeEach(() => {
  setSecure(true);
  gum = vi.fn(async () => makeStream().stream);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: gum }, configurable: true });
  geo = { ok: null, err: null, clear: vi.fn() };
  Object.defineProperty(navigator, 'geolocation', {
    value: { watchPosition: vi.fn((ok, err) => { geo.ok = ok; geo.err = err; return 1; }), clearWatch: geo.clear }, configurable: true,
  });
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  vi.mocked(captureStamped).mockReset();
  vi.mocked(captureStamped).mockResolvedValue(new Blob(['jpg'], { type: 'image/jpeg' }));
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true }); });

type TestProps = { title: string; onClose: Mock; onUse: Mock; onGallery: Mock };
const setup = (over: Partial<TestProps> = {}) => {
  const props: TestProps = { title: 'Cek Saluran Inlet SP-02', onClose: vi.fn(), onUse: vi.fn(async () => {}), onGallery: vi.fn(), ...over };
  const r = render(<CameraCapture {...props} />);
  return { ...r, props };
};
const fix = (lat = -3.78421, lng = 115.60214, accuracy = 9) => act(() => geo.ok!({ coords: { latitude: lat, longitude: lng, accuracy } }));
const live = async () => { await waitFor(() => expect(gum).toHaveBeenCalled()); await screen.findByRole('button', { name: 'Ambil foto' }); };

describe('CameraCapture: the dialog', () => {
  it('is a labelled modal dialog showing which event it is for, with focus on the close button', async () => {
    setup();
    const dlg = await screen.findByRole('dialog', { name: 'Kamera eviden' });
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Cek Saluran Inlet SP-02')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tutup kamera' })).toHaveFocus();
  });
  it('Escape and the close button both close it', async () => {
    const { props } = setup();
    await live();
    await userEvent.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Tutup kamera' }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
  it('shows the live view, the clock in WITA and the explanation', async () => {
    setup();
    await live();
    expect(document.querySelector('video')).not.toBeNull();
    expect(screen.getByText(/WITA/)).toBeInTheDocument();
    expect(screen.getByText('Geotag dan timestamp otomatis ditempel pada foto')).toBeInTheDocument();
  });
  it('shows the location state: searching, then coordinates', async () => {
    setup();
    await live();
    expect(screen.getByText('Mencari lokasi…')).toBeInTheDocument();
    fix();
    expect(await screen.findByText('GPS -3.78421, 115.60214')).toBeInTheDocument();
  });
  it('says so when location is refused or unavailable', async () => {
    setup();
    await live();
    act(() => geo.err!({ code: 1 }));
    expect(await screen.findByText('Lokasi tidak tersedia')).toBeInTheDocument();
  });
});

describe('CameraCapture: taking a photo', () => {
  it('stamps with the current position and previews the result', async () => {
    setup();
    await live();
    fix();
    await userEvent.click(screen.getByRole('button', { name: 'Ambil foto' }));
    expect(captureStamped).toHaveBeenCalledTimes(1);
    expect(vi.mocked(captureStamped).mock.calls[0][1]).toMatch(/^GPS -3\.78421, 115\.60214 - \d+ \w+ \d{4} \d{2}:\d{2} WITA$/);
    expect(await screen.findByRole('img', { name: 'Pratinjau foto' })).toHaveAttribute('src', 'blob:preview');
    expect(screen.getByRole('button', { name: 'Ulangi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gunakan foto' })).toBeInTheDocument();
  });
  it('without a position the stamp says "Tanpa lokasi"', async () => {
    setup();
    await live();
    await userEvent.click(screen.getByRole('button', { name: 'Ambil foto' }));
    expect(vi.mocked(captureStamped).mock.calls[0][1]).toMatch(/^Tanpa lokasi - /);
  });
  it('turns the camera off as soon as the photo is taken (no light left on)', async () => {
    const s = makeStream();
    gum.mockResolvedValue(s.stream);
    setup();
    await live();
    await userEvent.click(screen.getByRole('button', { name: 'Ambil foto' }));
    await screen.findByRole('img', { name: 'Pratinjau foto' });
    expect(s.tracks[0].stop).toHaveBeenCalled();
  });
  it('"Ulangi" drops the preview and opens the camera again', async () => {
    setup();
    await live();
    await userEvent.click(screen.getByRole('button', { name: 'Ambil foto' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ulangi' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    await screen.findByRole('button', { name: 'Ambil foto' });
    expect(gum).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('img', { name: 'Pratinjau foto' })).toBeNull();
  });
  it('"Gunakan foto" hands over the picture with position, accuracy and the time it was taken', async () => {
    const { props } = setup();
    await live();
    fix(-3.78421, 115.60214, 9);
    await userEvent.click(screen.getByRole('button', { name: 'Ambil foto' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Gunakan foto' }));
    expect(props.onUse).toHaveBeenCalledTimes(1);
    const photo = props.onUse.mock.calls[0][0];
    expect(photo.blob).toBeInstanceOf(Blob);
    expect(photo).toMatchObject({ lat: -3.78421, lng: 115.60214, accuracy: 9 });
    expect(Math.abs(Date.now() - Date.parse(photo.takenAt))).toBeLessThan(5000);
  });
  it('without a position it hands over null coordinates', async () => {
    const { props } = setup();
    await live();
    await userEvent.click(screen.getByRole('button', { name: 'Ambil foto' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Gunakan foto' }));
    expect(props.onUse.mock.calls[0][0]).toMatchObject({ lat: null, lng: null, accuracy: null });
  });
  it('cannot be closed while the photo is uploading, so a failure is never lost', async () => {
    let finish!: () => void;
    const onUse = vi.fn(() => new Promise<void>((r) => { finish = r; }));
    const { props } = setup({ onUse });
    await live();
    await userEvent.click(screen.getByRole('button', { name: 'Ambil foto' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Gunakan foto' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Tutup kamera' })).toBeDisabled();
    expect(props.onClose).not.toHaveBeenCalled();
    await act(async () => finish());
  });
  it('pressing "Gunakan foto" twice uploads once, and the button waits while it works', async () => {
    let finish!: () => void;
    const onUse = vi.fn(() => new Promise<void>((r) => { finish = r; }));
    setup({ onUse });
    await live();
    await userEvent.click(screen.getByRole('button', { name: 'Ambil foto' }));
    const use = await screen.findByRole('button', { name: 'Gunakan foto' });
    await userEvent.dblClick(use);
    expect(onUse).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Mengunggah/ })).toBeDisabled();
    await act(async () => finish());
  });
  it('pressing the shutter twice quickly takes one photo', async () => {
    let done!: (b: Blob) => void;
    vi.mocked(captureStamped).mockImplementation(() => new Promise<Blob>((r) => { done = r; }));
    setup();
    await live();
    const shutter = screen.getByRole('button', { name: 'Ambil foto' });
    await userEvent.dblClick(shutter);
    expect(captureStamped).toHaveBeenCalledTimes(1);
    await act(async () => done(new Blob(['x'])));
  });
  it('a failed capture shows a plain message and stays on the live view', async () => {
    vi.mocked(captureStamped).mockRejectedValue(new Error('Gagal membuat foto.'));
    setup();
    await live();
    await userEvent.click(screen.getByRole('button', { name: 'Ambil foto' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Gagal membuat foto.');
    expect(screen.getByRole('button', { name: 'Ambil foto' })).toBeEnabled();
  });
  it('a failed upload keeps the photo so it can be tried again', async () => {
    const onUse = vi.fn().mockRejectedValueOnce(new Error('Terjadi kesalahan. Coba lagi.')).mockResolvedValue(undefined);
    setup({ onUse });
    await live();
    await userEvent.click(screen.getByRole('button', { name: 'Ambil foto' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Gunakan foto' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Terjadi kesalahan. Coba lagi.');
    await userEvent.click(screen.getByRole('button', { name: 'Gunakan foto' }));
    expect(onUse).toHaveBeenCalledTimes(2);
  });
});

describe('CameraCapture: switching and the camera light', () => {
  it('"Balik kamera" asks for the other camera and stops the old one', async () => {
    const first = makeStream();
    gum.mockResolvedValueOnce(first.stream);
    setup();
    await live();
    expect(gum.mock.calls[0][0].video.facingMode).toEqual({ ideal: 'environment' });
    await userEvent.click(screen.getByRole('button', { name: 'Balik kamera' }));
    await waitFor(() => expect(gum).toHaveBeenCalledTimes(2));
    expect(gum.mock.calls[1][0].video.facingMode).toEqual({ ideal: 'user' });
    expect(first.tracks[0].stop).toHaveBeenCalled();
  });
  it('stops every track when the dialog goes away', async () => {
    const s = makeStream();
    gum.mockResolvedValue(s.stream);
    const { unmount } = setup();
    await live();
    unmount();
    expect(s.tracks[0].stop).toHaveBeenCalled();
    expect(geo.clear).toHaveBeenCalled();
  });
  it('a camera that arrives after the dialog was closed is stopped at once', async () => {
    const s = makeStream();
    let arrive!: (st: MediaStream) => void;
    gum.mockReturnValue(new Promise<MediaStream>((r) => { arrive = r; }));
    const { unmount } = setup();
    await waitFor(() => expect(gum).toHaveBeenCalled());
    unmount();
    await act(async () => arrive(s.stream));
    expect(s.tracks[0].stop).toHaveBeenCalled();
  });
});

describe('CameraCapture: when the camera cannot be used', () => {
  it('plain HTTP: says why, never asks for the camera, and the gallery still works', async () => {
    setSecure(false);
    const { props } = setup();
    expect(await screen.findByRole('alert')).toHaveTextContent('Kamera butuh koneksi aman (HTTPS).');
    expect(gum).not.toHaveBeenCalled();
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText('Pilih dari galeri'), file);
    expect(props.onGallery).toHaveBeenCalledWith(file);
  });
  it.each([
    ['NotAllowedError', 'Izin kamera ditolak. Aktifkan di pengaturan peramban.'],
    ['NotFoundError', 'Kamera tidak ditemukan.'],
    ['AbortError', 'Kamera tidak bisa dibuka. Coba lagi.'],
  ])('%s shows its own message and keeps the gallery', async (name, message) => {
    gum.mockRejectedValue(Object.assign(new Error('x'), { name }));
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('Pilih dari galeri')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ambil foto' })).toBeNull();
  });
  it('a general failure can be retried', async () => {
    gum.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'AbortError' }));
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByRole('button', { name: 'Ambil foto' })).toBeInTheDocument();
  });
  it('a stream that was half-open when permission failed is not left running', async () => {
    gum.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    const { unmount } = setup();
    await screen.findByRole('alert');
    unmount();
    expect(geo.clear).toHaveBeenCalled();
  });
});

describe('CameraCapture: touch targets and labels', () => {
  it('every control has a name', async () => {
    setup();
    await live();
    for (const n of ['Tutup kamera', 'Ambil foto', 'Balik kamera']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    expect(screen.getByLabelText('Pilih dari galeri')).toBeInTheDocument();
  });
});
