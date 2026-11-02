import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberField } from './NumberField';

describe('NumberField', () => {
  it('flags out-of-limit value', () => {
    render(<NumberField label="pH outlet" value={5.5} onChange={() => {}} threshold={{ min: 6, max: 9 }} />);
    expect(screen.getByLabelText('pH outlet')).toHaveClass('is-alert');
  });
  it('no flag inside limit', () => {
    render(<NumberField label="pH outlet" value={7} onChange={() => {}} threshold={{ min: 6, max: 9 }} />);
    expect(screen.getByLabelText('pH outlet')).not.toHaveClass('is-alert');
  });
  it('uses a decimal keypad', () => {
    render(<NumberField label="TSS" value={null} onChange={() => {}} />);
    expect(screen.getByLabelText('TSS')).toHaveAttribute('inputmode', 'decimal');
  });
  it('typing a number reports it; clearing reports null', async () => {
    const onChange = vi.fn();
    render(<NumberField label="TSS" value={null} onChange={onChange} />);
    const input = screen.getByLabelText('TSS');
    await userEvent.type(input, '12.5');
    expect(onChange).toHaveBeenLastCalledWith(12.5);
    await userEvent.clear(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
  it('readOnly blocks typing', () => {
    render(<NumberField label="TSS" value={3} onChange={() => {}} readOnly />);
    expect(screen.getByLabelText('TSS')).toHaveAttribute('readonly');
  });
});
