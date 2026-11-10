// Stroke icons used across the app. Decorative by default (aria-hidden).

import type { SVGProps } from 'react';

const PATHS = {
  critical: ['M12 3l10 18H2z', 'M12 10v5M12 18h.01'],
  triangle: ['M12 3l10 18H2z'],
  warning: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 7v6M12 16.5h.01'],
  circle: ['M12 3a9 9 0 100 18 9 9 0 000-18z'],
  check: ['M5 12l5 5 9-10'],
  stale: ['M4 12h3M10 12h4M17 12h3'],
  close: ['M6 6l12 12M18 6L6 18'],
  plus: ['M12 5v14M5 12h14'],
  search: ['M11 4a7 7 0 100 14 7 7 0 000-14z', 'M20 20l-4-4'],
  filter: ['M4 6h16M7 12h10M10 18h4'],
  download: ['M12 4v11M7 10l5 5 5-5M5 20h14'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 018 0v4'],
  shield: ['M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z', 'M8.5 12l2.5 2.5 4.5-5'],
  offline: ['M3 3l18 18', 'M7 18h10a4 4 0 001.4-7.7A6 6 0 008.2 7.6', 'M4.6 9.6A4.5 4.5 0 007 18'],
  sync: ['M20 12a8 8 0 01-14 5.3M4 12a8 8 0 0114-5.3', 'M18 3v4h-4M6 21v-4h4'],
  truck: ['M3 7h11v9H3zM14 10h4l3 3v3h-7', 'M7 16a2 2 0 100 4 2 2 0 000-4zM17 16a2 2 0 100 4 2 2 0 000-4z'],
  user: ['M12 4a4 4 0 100 8 4 4 0 000-8z', 'M4 21a8 8 0 0116 0'],
  qr: ['M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3', 'M8 8h3v3H8zM13 13h3v3h-3zM13 8h3M8 13v3'],
  phone: ['M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2'],
  back: ['M15 5l-7 7 7 7'],
  logo: ['M14 3v22M5 8.5l18 11M23 8.5l-18 11', 'M11 5l3 3 3-3M11 23l3-3 3 3'],
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function Icon({ name, size = 16, strokeWidth = 2, label, ...rest }: IconProps) {
  const viewBox = name === 'logo' ? '0 0 28 28' : '0 0 24 24';
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
