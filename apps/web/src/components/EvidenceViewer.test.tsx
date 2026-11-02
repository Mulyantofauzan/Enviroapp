import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceViewer } from './EvidenceViewer';

const item = {
  id: 'e1', filename: 'saluran-inlet.jpg', mime: 'image/jpeg', size: 245_000, source: 'camera' as const,
  gps_lat: -3.78421, gps_lng: 115.60214, gps_accuracy: 9, taken_at: '2026-11-02T00:21:00.000Z', uploaded_at: '2026-11-02T00:22:30.000Z',
  uploaded_by_name: 'Rudi Hartono', title: 'Cek Saluran Inlet', due_date: '2026-11-02',
};

describe('EvidenceViewer', () => {
  it('is a modal dialog with the whole picture and what is known about it', () => {
    render(<EvidenceViewer item={item} onClose={() => {}} />);
    const dlg = screen.getByRole('dialog', { name: 'Pratinjau eviden' });
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('img', { name: 'saluran-inlet.jpg' })).toHaveAttribute('src', '/api/evidence/e1/file');
    expect(screen.getByText('Cek Saluran Inlet')).toBeInTheDocument();
    expect(screen.getByText('GPS -3.78421, 115.60214')).toBeInTheDocument();
    expect(screen.getByText(/Rudi Hartono/)).toBeInTheDocument();
  });
  it('tells the time the phone says it was taken and the time the server received it, in WITA', () => {
    render(<EvidenceViewer item={item} onClose={() => {}} />);
    expect(screen.getByText('Diambil 2 Nov 2026 08:21 WITA')).toBeInTheDocument();
    expect(screen.getByText('Diunggah 2 Nov 2026 08:22 WITA')).toBeInTheDocument();
  });
  it('a gallery file has no "Diambil" line', () => {
    render(<EvidenceViewer item={{ ...item, source: 'gallery', gps_lat: null, gps_lng: null, taken_at: null }} onClose={() => {}} />);
    expect(screen.queryByText(/^Diambil/)).toBeNull();
    expect(screen.getByText('Galeri')).toBeInTheDocument();
  });
  it('offers the original for download', () => {
    render(<EvidenceViewer item={item} onClose={() => {}} />);
    const dl = screen.getByRole('link', { name: 'Unduh' });
    expect(dl).toHaveAttribute('href', '/api/evidence/e1/file');
    expect(dl).toHaveAttribute('download', 'saluran-inlet.jpg');
  });
  it('closes with the button and with Escape, and focus starts on the close button', async () => {
    const onClose = vi.fn();
    render(<EvidenceViewer item={item} onClose={onClose} />);
    expect(screen.getByRole('button', { name: 'Tutup' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Tutup' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
