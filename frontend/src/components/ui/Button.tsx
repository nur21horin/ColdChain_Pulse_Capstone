import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: IconName;
  busy?: boolean;
}

export function Button({ variant = 'primary', icon, busy, children, className, disabled, type = 'button', ...rest }: Props) {
  return (
    <button type={type} className={`btn btn-${variant}${className ? ` ${className}` : ''}`} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {icon && <Icon name={icon} />}
      {busy ? 'Working…' : children}
    </button>
  );
}
