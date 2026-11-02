import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { Badge } from './Badge';
import { Segmented } from './Segmented';
import { Toggle } from './Toggle';
import { Banner } from './Banner';
import { ScreenHeader } from './ScreenHeader';
import { PondPicker } from './PondPicker';
import { Icon } from '../icons';

afterEach(() => { Object.defineProperty(navigator, 'onLine', { value: true, configurable: true }); });

describe('Button', () => {
  it('danger variant has its class', () => {
    render(<Button variant="danger">Hapus</Button>);
    expect(screen.getByRole('button', { name: 'Hapus' })).toHaveClass('ui-btn--danger');
  });
  it('is a real button that fires onClick', async () => {
    const f = vi.fn();
    render(<Button onClick={f}>Simpan</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(f).toHaveBeenCalled();
  });
});

describe('Badge', () => {
  it('shows its word, not only a colour', () => {
    render(<Badge tone="danger">Abnormal</Badge>);
    expect(screen.getByText('Abnormal')).toHaveClass('ui-badge--danger');
  });
});

describe('Segmented', () => {
  it('marks the selected option and reports a change', async () => {
    const f = vi.fn();
    render(<Segmented label="Titik" options={[{ value: 'in', label: 'Inlet' }, { value: 'out', label: 'Outlet' }]} value="in" onChange={f} />);
    expect(screen.getByRole('tab', { name: 'Inlet' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Outlet' }));
    expect(f).toHaveBeenCalledWith('out');
  });
});

describe('Toggle', () => {
  it('is a switch that reports the new value', async () => {
    const f = vi.fn();
    render(<Toggle label="Aktif" checked={false} onChange={f} />);
    const sw = screen.getByRole('switch', { name: 'Aktif' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(sw);
    expect(f).toHaveBeenCalledWith(true);
  });
});

describe('Banner', () => {
  it('shows title and body', () => {
    render(<Banner tone="warning" title="Nilai abnormal hanya disorot">Data tetap tersimpan</Banner>);
    expect(screen.getByText('Nilai abnormal hanya disorot')).toBeInTheDocument();
    expect(screen.getByText('Data tetap tersimpan')).toBeInTheDocument();
  });
});

describe('ScreenHeader', () => {
  it('has a labelled profile button', async () => {
    const f = vi.fn();
    render(<ScreenHeader title="Input" subtitle="SP-02" onProfile={f} />);
    expect(screen.getByText('SP-02')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Buka akun' }));
    expect(f).toHaveBeenCalled();
  });
});

describe('PondPicker', () => {
  const ponds = [
    { id: 'a', code: 'SP-01', name: 'Pit Utara', is_active: true },
    { id: 'b', code: null, name: 'SP 2', is_active: true },
  ];
  it('lists ponds as "kode nama" or just the name', () => {
    render(<PondPicker ponds={ponds as any} value="a" onChange={() => {}} />);
    expect(screen.getByRole('option', { name: 'SP-01 Pit Utara' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'SP 2' })).toBeInTheDocument();
  });
  it('reports the chosen pond id', async () => {
    const f = vi.fn();
    render(<PondPicker ponds={ponds as any} value="a" onChange={f} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Settling Pond' }), 'b');
    expect(f).toHaveBeenCalledWith('b');
  });
});

describe('Icon', () => {
  it('is hidden from assistive tech without a label', () => {
    const { container } = render(<Icon name="home" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
  it('is an image with a name when labelled', () => {
    render(<Icon name="home" label="Beranda" />);
    expect(screen.getByRole('img', { name: 'Beranda' })).toBeInTheDocument();
  });
});
