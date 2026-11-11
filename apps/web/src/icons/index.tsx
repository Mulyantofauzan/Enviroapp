import type { ReactNode } from 'react';

// Hand-drawn line icons, 24px grid. Shapes follow the EVOS Figma components.
const PATHS = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></>,
  clipboard: <><rect x="5" y="4.5" width="14" height="16.5" rx="2.5" /><rect x="9" y="2.8" width="6" height="3.4" rx="1.2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  chart: <><path d="M4 20h16" /><path d="M7.5 20v-6M12 20V6M16.5 20v-9" /></>,
  user: <><circle cx="12" cy="8.5" r="3.6" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>,
  users: <><circle cx="9" cy="8.5" r="3" /><path d="M3 19.5c0-3 2.7-5 6-5s6 2 6 5" /><circle cx="17" cy="9.5" r="2.4" /><path d="M17 14.5c2.3 0 4 1.5 4 4" /></>,
  database: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></>,
  pin: <><path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  'cloud-rain': <><path d="M7 15.5h-.4A3.6 3.6 0 0 1 6.9 8.4a5 5 0 0 1 9.7-.4A3.8 3.8 0 0 1 17 15.5" /><path d="M8.5 18l-1 2.4M12.5 18l-1 2.4M16.5 18l-1 2.4" /></>,
  droplet: <path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.300 6-10.500 6-10.500z" />,
  flask: <><path d="M9.5 3.5h5M10.5 3.5v6L5.2 18.2A2 2 0 0 0 6.9 21h10.2a2 2 0 0 0 1.7-2.8L13.5 9.5v-6" /><path d="M8 15h8" /></>,
  alert: <><path d="M10.3 4.6 3 17.4a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3L13.700 4.600a2 2 0 0 0-3.400 0z" /><path d="M12 9.500v4M12 16.800h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.800h.01" /></>,
  'chevron-down': <path d="m6 9.500 6 6 6-6" />,
  'chevron-right': <path d="m9.500 6 6 6-6 6" />,
  search: <><circle cx="11" cy="11" r="6.500" /><path d="m20 20-4.200-4.200" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  pencil: <><path d="m4.500 19.500 1-4.200L16.300 4.500a2 2 0 0 1 2.900 0l.3.3a2 2 0 0 1 0 2.900L8.700 18.500z" /><path d="m13.500 7.500 3 3" /></>,
  check: <path d="m5 12.500 4.500 4.500L19 7.500" />,
  file: <><path d="M14 3.500H7.500A1.500 1.500 0 0 0 6 5v14a1.500 1.500 0 0 0 1.500 1.500h9A1.500 1.500 0 0 0 18 19V7.500z" /><path d="M14 3.500v4h4M9 12.500h6M9 16h6" /></>,
  'cloud-off': <><path d="M7 18.500h9.500a3.500 3.500 0 0 0 1.400-6.700A5 5 0 0 0 9.300 9.800" /><path d="M5.500 10.500A4 4 0 0 0 7 18.500" /><path d="m3 3 18 18" /></>,
  'log-out': <><path d="M9 4.500H6A1.500 1.500 0 0 0 4.500 6v12A1.500 1.500 0 0 0 6 19.500h3" /><path d="m15 8 4 4-4 4M19 12H9" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  camera: <><path d="M4 8.500A1.500 1.500 0 0 1 5.500 7h2.200l1.300-2h6l1.300 2h2.200A1.500 1.500 0 0 1 20 8.500v9a1.500 1.500 0 0 1-1.500 1.500h-13A1.500 1.500 0 0 1 4 17.500z" /><circle cx="12" cy="13" r="3.500" /></>,
  image: <><rect x="3.500" y="4.500" width="17" height="15" rx="2.500" /><circle cx="9" cy="10" r="1.700" /><path d="m4 17.500 4.500-4.500 3.500 3.500 2.500-2.500 5.500 5" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.300-4.300L4 8.500" /><path d="M4 4v4.500h4.500" /><path d="M4 13a8 8 0 0 0 14.300 4.300L20 15.500" /><path d="M20 20v-4.500h-4.500" /></>,
  download: <><path d="M12 4v11" /><path d="m7.500 11 4.500 4.500 4.500-4.500" /><path d="M5 19.500h14" /></>,
  upload: <><path d="M12 16V5" /><path d="m7.500 9.500 4.500-4.500 4.500 4.500" /><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></>,
  trash: <><path d="M4.500 7h15" /><path d="M9.500 7V4.500h5V7" /><path d="M6.500 7l.8 12a1.500 1.500 0 0 0 1.500 1.400h6.400a1.500 1.500 0 0 0 1.500-1.400l.8-12" /><path d="M10 11v6M14 11v6" /></>,
  'chevron-left': <path d="m14.500 6-6 6 6 6" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" className="ui-icon"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {PATHS[name]}
    </svg>
  );
}
