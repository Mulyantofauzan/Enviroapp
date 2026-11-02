import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoagulantRow, type CoagState } from './CoagulantRow';

function Harness({ previous, initial }: { previous: number | null; initial: CoagState }) {
  const [v, setV] = useState(initial);
  return <CoagulantRow type="Kapur" previousRemaining={previous} value={v} onChange={setV} />;
}
const empty: CoagState = { stock_in: null, stock_out: null, stock_remaining: null };

describe('CoagulantRow', () => {
  it('shows remaining = previous + in - out', () => {
    render(<Harness previous={5} initial={{ ...empty, stock_in: 10, stock_out: 3 }} />);
    expect(screen.getByLabelText('Kapur remaining')).toHaveValue('12');
  });
  it('warns below zero but keeps the value', () => {
    render(<Harness previous={2} initial={{ ...empty, stock_in: 0, stock_out: 5 }} />);
    expect(screen.getByText('Stock is below zero. Check your count.')).toBeInTheDocument();
    expect(screen.getByLabelText('Kapur remaining')).toHaveValue('-3');
  });
  it('no warning when stock is fine', () => {
    render(<Harness previous={5} initial={{ ...empty, stock_in: 1, stock_out: 1 }} />);
    expect(screen.queryByText(/below zero/)).toBeNull();
  });
  it('typed remaining overrides the calculation', async () => {
    render(<Harness previous={5} initial={{ ...empty, stock_in: 10, stock_out: 3 }} />);
    const rem = screen.getByLabelText('Kapur remaining');
    await userEvent.clear(rem);
    await userEvent.type(rem, '4');
    expect(rem).toHaveValue('4');
  });
});
