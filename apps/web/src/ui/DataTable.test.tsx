import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './DataTable';

type Row = { id: string; name: string; n: number };
const columns = [
  { key: 'name', header: 'Nama', sticky: true, render: (r: Row) => r.name },
  { key: 'n', header: 'Nilai', align: 'right' as const, render: (r: Row) => r.n, cellClass: (r: Row) => (r.n > 100 ? 'is-bad' : '') },
];
const rows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: String(i), name: `Baris ${i + 1}`, n: i }));
const props = { caption: 'Contoh data', columns, rowKey: (r: Row) => r.id, emptyText: 'Kosong.' };

describe('DataTable', () => {
  it('is a table with a caption, column headers and a labelled scroll region', () => {
    render(<DataTable {...props} rows={rows(3)} />);
    const table = screen.getByRole('table', { name: 'Contoh data' });
    expect(within(table).getByRole('columnheader', { name: 'Nama' })).toHaveAttribute('scope', 'col');
    const region = screen.getByRole('region', { name: 'Contoh data' });
    expect(region).toHaveAttribute('tabindex', '0');
  });
  it('shows 50 rows first and 50 more each time', async () => {
    render(<DataTable {...props} rows={rows(120)} />);
    expect(screen.getAllByRole('row')).toHaveLength(51);
    await userEvent.click(screen.getByRole('button', { name: 'Tampilkan lebih banyak' }));
    expect(screen.getAllByRole('row')).toHaveLength(101);
    await userEvent.click(screen.getByRole('button', { name: 'Tampilkan lebih banyak' }));
    expect(screen.getAllByRole('row')).toHaveLength(121);
    expect(screen.queryByRole('button', { name: 'Tampilkan lebih banyak' })).toBeNull();
  });
  it('honours a custom page size', () => {
    render(<DataTable {...props} rows={rows(30)} pageSize={10} />);
    expect(screen.getAllByRole('row')).toHaveLength(11);
  });
  it('says so when there are no rows, and draws no table', () => {
    render(<DataTable {...props} rows={[]} />);
    expect(screen.getByText('Kosong.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('the first column sticks, and numbers align right', () => {
    render(<DataTable {...props} rows={rows(2)} />);
    expect(screen.getByRole('columnheader', { name: 'Nama' })).toHaveClass('is-sticky');
    expect(screen.getByRole('cell', { name: 'Baris 1' })).toHaveClass('is-sticky');
    expect(screen.getByRole('columnheader', { name: 'Nilai' })).toHaveClass('is-right');
  });
  it('a cell class is applied per row', () => {
    render(<DataTable {...props} rows={[{ id: 'a', name: 'A', n: 500 }, { id: 'b', name: 'B', n: 5 }]} />);
    expect(screen.getByRole('cell', { name: '500' })).toHaveClass('is-bad');
    expect(screen.getByRole('cell', { name: '5' })).not.toHaveClass('is-bad');
  });
});
