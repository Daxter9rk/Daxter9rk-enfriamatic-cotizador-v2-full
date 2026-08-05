import type {SVGProps} from 'react';

export type IconName =
  | 'home'
  | 'users'
  | 'client'
  | 'site'
  | 'equipment'
  | 'request'
  | 'quote'
  | 'catalog'
  | 'activity'
  | 'settings'
  | 'manual'
  | 'support'
  | 'bell'
  | 'refresh'
  | 'search'
  | 'plus'
  | 'map'
  | 'copy'
  | 'file'
  | 'shield';

const paths: Record<IconName, string[]> = {
  home: ['M3 11.5 12 4l9 7.5', 'M5 10.5V20h14v-9.5', 'M9 20v-6h6v6'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  client: ['M3 21h18', 'M6 21V5h9v16', 'M15 9h3v12', 'M9 8h2', 'M9 12h2', 'M9 16h2'],
  site: ['M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  equipment: ['M4 8h16v10H4z', 'M8 4h8l2 4', 'M8 13h.01', 'M12 13h4'],
  request: ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  quote: ['M6 2h9l5 5v15H6z', 'M14 2v6h6', 'M9 13h6', 'M9 17h6'],
  catalog: ['M4 4h16v16H4z', 'M4 9h16', 'M9 4v16'],
  activity: ['M3 12h4l2-7 4 14 2-7h6'],
  settings: [
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.57V21h-3v-.77a1.7 1.7 0 0 0-1.04-1.57 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.57-1.04H4v-3h1.43A1.7 1.7 0 0 0 7 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06A1.7 1.7 0 0 0 10.66 5 1.7 1.7 0 0 0 11.7 3.43V3h3v.43A1.7 1.7 0 0 0 15.74 5a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 21 10.04H22v3h-1a1.7 1.7 0 0 0-1.6 1Z',
  ],
  manual: [
    'M4 5a3 3 0 0 1 3-3h5v18H7a3 3 0 0 0-3 3Z',
    'M20 5a3 3 0 0 0-3-3h-5v18h5a3 3 0 0 1 3 3Z',
  ],
  support: ['M4 14a8 8 0 0 1 16 0', 'M4 14v4h4v-6H4', 'M20 14v4h-4v-6h4', 'M16 20c0 1-1 2-3 2'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'],
  refresh: ['M20 11a8 8 0 1 0-2 5.5', 'M20 4v7h-7'],
  search: ['M21 21l-4.35-4.35', 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z'],
  plus: ['M12 5v14', 'M5 12h14'],
  map: ['M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z', 'M9 3v15', 'M15 6v15'],
  copy: ['M8 8h12v12H8z', 'M4 16V4h12'],
  file: ['M6 2h9l5 5v15H6z', 'M14 2v6h6'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z', 'm9 12 2 2 4-5'],
};

export function Icon({name, ...props}: {name: IconName} & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}
