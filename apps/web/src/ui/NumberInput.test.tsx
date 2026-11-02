import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberInput } from './NumberInput';

describe('NumberInput', () => {
  it('out-of-limit value is flagged with the range', () => {
    render(<NumberInput label="pH" value={5.8} onChange={() => {}} threshold={{ min: 6, max: 9 }} />);
    expect(screen.getByLabelText('pH')).toHaveClass('is-alert');
    expect(screen.getByText('Di luar baku mutu 6-9')).toBeInTheDocument();
  });
  it('in-limit value is not flagged', () => {
    render(<NumberInput label="pH" value={7} onChange={() => {}} threshold={{ min: 6, max: 9 }} />);
    expect(screen.getByLabelText('pH')).not.toHaveClass('is-alert');
    expect(screen.queryByText(/Di luar baku mutu/)).toBeNull();
  });
  it('only a maximum: message says so', () => {
    render(<NumberInput label="TSS" value={50} onChange={() => {}} threshold={{ min: null, max: 40 }} />);
    expect(screen.getByText('Di luar baku mutu (maks. 40)')).toBeInTheDocument();
  });
  it('comma decimal is accepted', async () => {
    const f = vi.fn();
    render(<NumberInput label="pH" value={null} onChange={f} />);
    await userEvent.type(screen.getByLabelText('pH'), '7,2');
    expect(f).toHaveBeenLastCalledWith(7.2);
  });
  it('clearing reports null', async () => {
    const f = vi.fn();
    render(<NumberInput label="pH" value={7} onChange={f} />);
    await userEvent.clear(screen.getByLabelText('pH'));
    expect(f).toHaveBeenLastCalledWith(null);
  });
  it('text shows "Masukkan angka" and marks the field invalid', async () => {
    render(<NumberInput label="pH" value={null} onChange={() => {}} />);
    await userEvent.type(screen.getByLabelText('pH'), 'abc');
    expect(screen.getByText('Masukkan angka')).toBeInTheDocument();
    expect(screen.getByLabelText('pH')).toHaveAttribute('aria-invalid', 'true');
  });
  it('thousands format is rejected, not guessed', async () => {
    render(<NumberInput label="Debit" value={null} onChange={() => {}} />);
    await userEvent.type(screen.getByLabelText('Debit'), '1.278,7');
    expect(screen.getByText('Masukkan angka')).toBeInTheDocument();
  });
  it('auto field shows the chip and formatted read-only value', () => {
    render(<NumberInput label="Debit harian" unit="m3/d" value={1278.72} auto readOnly onChange={() => {}} />);
    expect(screen.getByText('Otomatis')).toBeInTheDocument();
    expect(screen.getByLabelText('Debit harian')).toHaveValue('1.278,7');
    expect(screen.getByLabelText('Debit harian')).toHaveAttribute('readonly');
  });
  it('keypad is decimal', () => {
    render(<NumberInput label="TSS" value={null} onChange={() => {}} />);
    expect(screen.getByLabelText('TSS')).toHaveAttribute('inputmode', 'decimal');
  });
  it('external value change updates the box', () => {
    const { rerender } = render(<NumberInput label="Sisa" value={10} onChange={() => {}} />);
    rerender(<NumberInput label="Sisa" value={12.5} onChange={() => {}} />);
    expect(screen.getByLabelText('Sisa')).toHaveValue('12,5');
  });
});
