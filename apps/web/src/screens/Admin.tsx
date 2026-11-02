import { useState } from 'react';
import { UsersPanel } from './admin/UsersPanel';
import { PondsPanel } from './admin/PondsPanel';
import { ThresholdsPanel } from './admin/ThresholdsPanel';

const PANELS = { Users: UsersPanel, Ponds: PondsPanel, Limits: ThresholdsPanel } as const;

export function Admin() {
  const [tab, setTab] = useState<keyof typeof PANELS>('Users');
  const Panel = PANELS[tab];
  return (
    <div className="stack">
      <h2>Admin</h2>
      <div className="chips" role="tablist">
        {(Object.keys(PANELS) as (keyof typeof PANELS)[]).map((k) => (
          <button key={k} role="tab" aria-selected={k === tab} className={k === tab ? 'chip is-active' : 'chip'} onClick={() => setTab(k)}>{k}</button>
        ))}
      </div>
      <Panel />
    </div>
  );
}
