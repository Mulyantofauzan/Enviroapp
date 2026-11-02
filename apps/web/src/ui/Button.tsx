import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'danger'; block?: boolean };

export function Button({ variant = 'primary', block, className = '', ...rest }: Props) {
  return <button type="button" {...rest} className={`ui-btn ui-btn--${variant}${block ? ' ui-btn--block' : ''} ${className}`.trim()} />;
}
