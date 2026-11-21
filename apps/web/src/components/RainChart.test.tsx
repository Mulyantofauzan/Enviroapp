import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RainChart } from './RainChart';

const s = (vals: (number | null)[]) => vals.map((value, i) => ({ date: `2026-11-0${i + 1}`, value }));

describe('RainChart', () => {
  it('names itself with the total, in Indonesian number format', () => {
    render(<RainChart series={s([12.5, 4, null])} />);
    expect(screen.getByRole('img', { name: 'Grafik curah hujan, 3 hari. Total 16,5 mm.' })).toBeInTheDocument();
  });
  it('mounts an echarts svg', async () => {
    const { container } = render(<RainChart series={s([1, 2, 3])} />);
    await waitFor(() => expect(container.querySelector('.ui-echart svg')).not.toBeNull());
  });
  it('ships a data table', () => {
    render(<RainChart series={s([1, 2, 3])} />);
    expect(screen.getByRole('columnheader', { name: 'Curah hujan (mm)' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });
  it('renders nothing when there is no rainfall record at all', () => {
    const { container } = render(<RainChart series={s([null, null])} />);
    expect(container).toBeEmptyDOMElement();
  });
});
