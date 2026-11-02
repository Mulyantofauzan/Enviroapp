import type { ReactNode } from 'react';

export type Tone = 'success' | 'danger' | 'danger-solid' | 'primary' | 'water' | 'warning' | 'neutral' | 'purple';

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}
