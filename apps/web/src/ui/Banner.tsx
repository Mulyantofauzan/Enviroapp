import type { ReactNode } from 'react';
import { Icon } from '../icons';

const ICON = { info: 'info', warning: 'alert', danger: 'alert' } as const;

export function Banner({ tone, title, children }: { tone: 'info' | 'warning' | 'danger'; title: string; children?: ReactNode }) {
  return (
    <div className={`ui-banner ui-banner--${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon name={ICON[tone]} />
      <div><strong>{title}</strong>{children && <p>{children}</p>}</div>
    </div>
  );
}
