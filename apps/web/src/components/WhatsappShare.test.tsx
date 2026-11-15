import { describe, it, expect, vi } from 'vitest';
import * as wa from '../lib/waReport';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from './Toast';
import { WhatsappShare } from './WhatsappShare';
import type { DayData } from '../hooks/useDay';

const data: DayData = {
  weather: { rainfall_mm: 0, rain_hours: null },
  water: { ph_inlet: 6, ph_outlet: 7, tss_inlet: 28, tss_outlet: 48, debit_inlet_m3s: null, debit_outlet_m3s: 0.00441 },
  coagulant: { 'Tawas Serbuk': null, 'Tawas Batu': { stock_in: null, stock_out: 50, stock_remaining: null }, Kapur: null },
  previousRemaining: { 'Tawas Serbuk': null, 'Tawas Batu': null, Kapur: null },
};

describe('WhatsappShare', () => {
  it('previews the saved numbers and updates when a field changes', async () => {
    render(<ToastProvider><WhatsappShare title="SP-11" placeCode="SP-11" date="2026-11-09" data={data} onClose={() => {}} /></ToastProvider>);
    const preview = screen.getByLabelText('Pratinjau pesan');
    expect(preview).toHaveTextContent('TSS Outlet : 48 mg/L');
    expect(preview).toHaveTextContent('Debit Outlet : 4,41 L/s');
    await userEvent.clear(screen.getByLabelText('Remain (sack)'));
    await userEvent.type(screen.getByLabelText('Remain (sack)'), '289');
    expect(preview).toHaveTextContent('Remain : 289 sack');
    expect(screen.getByLabelText('Batu (sack)')).toHaveValue('2'); // 50 kg at 25 kg a sack
  });
  it('opens WhatsApp with the message', async () => {
    const open = vi.spyOn(wa, 'openWhatsapp').mockImplementation(() => {});
    render(<ToastProvider><WhatsappShare title="SP-11" placeCode="SP-11" date="2026-11-09" data={data} onClose={() => {}} /></ToastProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Kirim ke WhatsApp' }));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('Pengelolaan Kualitas Air'));
    open.mockRestore();
  });
});
