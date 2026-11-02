import { m3sToM3d } from '@evo/shared';

const fmt = (m3s: number | null) => (m3s === null ? '–' : Math.round(m3sToM3d(m3s)).toLocaleString('en-US'));

type Props = { inletFlow: number | null; outletFlow: number | null; outletOut: boolean };

export function FlowStrip({ inletFlow, outletFlow, outletOut }: Props) {
  return (
    <div className="flowstrip" aria-label="Daily flow">
      <div className="flow-end" data-testid="flow-inlet">
        <small>In</small>
        <strong>{fmt(inletFlow)}</strong>
        <small>m³/d</small>
      </div>
      <div className={`flow-line${outletOut ? ' is-alert' : ''}`} aria-hidden="true" />
      <div className={`flow-end${outletOut ? ' is-alert' : ''}`} data-testid="flow-outlet">
        <small>Out</small>
        <strong>{fmt(outletFlow)}</strong>
        <small>m³/d</small>
      </div>
    </div>
  );
}
