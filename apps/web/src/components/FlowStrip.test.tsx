import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlowStrip } from './FlowStrip';

describe('FlowStrip', () => {
  it('shows daily flow derived from m3/s', () => {
    render(<FlowStrip inletFlow={1} outletFlow={0.5} outletOut={false} />);
    expect(screen.getByText('43,200')).toBeInTheDocument();
    expect(screen.getByText('86,400')).toBeInTheDocument();
  });
  it('shows a dash when flow is empty', () => {
    render(<FlowStrip inletFlow={null} outletFlow={null} outletOut={false} />);
    expect(screen.getAllByText('–')).toHaveLength(2);
  });
  it('marks the outlet when out of limit', () => {
    render(<FlowStrip inletFlow={1} outletFlow={1} outletOut />);
    expect(screen.getByTestId('flow-outlet')).toHaveClass('is-alert');
  });
});
