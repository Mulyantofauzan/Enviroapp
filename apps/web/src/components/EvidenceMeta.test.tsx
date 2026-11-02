import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidenceMeta } from './EvidenceMeta';

describe('EvidenceMeta', () => {
  it('a camera photo with a fix shows its coordinates', () => {
    render(<EvidenceMeta e={{ source: 'camera', gps_lat: -3.78421, gps_lng: 115.60214 }} />);
    expect(screen.getByText('GPS -3.78421, 115.60214')).toBeInTheDocument();
  });
  it('a camera photo without a fix is marked "Tanpa lokasi"', () => {
    render(<EvidenceMeta e={{ source: 'camera', gps_lat: null, gps_lng: null }} />);
    expect(screen.getByText('Tanpa lokasi')).toBeInTheDocument();
    expect(screen.queryByText(/^GPS/)).toBeNull();
  });
  it('a gallery file is marked "Galeri"', () => {
    render(<EvidenceMeta e={{ source: 'gallery', gps_lat: null, gps_lng: null }} />);
    expect(screen.getByText('Galeri')).toBeInTheDocument();
  });
  it('rows from before this feature (no source) read as gallery', () => {
    render(<EvidenceMeta e={{}} />);
    expect(screen.getByText('Galeri')).toBeInTheDocument();
  });
});
