import type { ReactNode, SVGProps } from 'react';

/** Small line icons drawn for this site (24×24, stroke uses currentColor). */
function Icon({
  children,
  size = 18,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement> & { size?: number };

export const IconCheck = (p: P) => (
  <Icon {...p}>
    <path d="M5 12.5 L10 17 L19 7" />
  </Icon>
);
export const IconX = (p: P) => (
  <Icon {...p}>
    <path d="M6 6 L18 18 M18 6 L6 18" />
  </Icon>
);
export const IconSun = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
  </Icon>
);
export const IconMoon = (p: P) => (
  <Icon {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </Icon>
);
export const IconFlame = (p: P) => (
  <Icon {...p}>
    <path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3.2 2.3-5 3.5-7.5.6 1.6 1.5 2.6 2.6 3C11 7.5 12.5 5 14.5 3c.4 3.4 4 5.8 4 11 0 3.6-2.6 7-6.5 7Z" />
  </Icon>
);
export const IconStar = (p: P) => (
  <Icon {...p}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" />
  </Icon>
);
export const IconClock = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);
export const IconInfo = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
);
export const IconArrowLeft = (p: P) => (
  <Icon {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);
export const IconArrowRight = (p: P) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
export const IconBook = (p: P) => (
  <Icon {...p}>
    <path d="M4 5.5C6.5 4 9.5 4 12 5.5v14c-2.5-1.5-5.5-1.5-8 0Z" />
    <path d="M20 5.5C17.5 4 14.5 4 12 5.5v14c2.5-1.5 5.5-1.5 8 0Z" />
  </Icon>
);
export const IconTarget = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
  </Icon>
);
export const IconTrophy = (p: P) => (
  <Icon {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
    <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" />
  </Icon>
);
export const IconCards = (p: P) => (
  <Icon {...p}>
    <rect x="7" y="4" width="12" height="15" rx="2" />
    <path d="M4.5 7.5v10A2.5 2.5 0 0 0 7 20h8" />
  </Icon>
);
export const IconChart = (p: P) => (
  <Icon {...p}>
    <path d="M4 20h16" />
    <path d="M6 16l4-5 3 3 5-7" />
  </Icon>
);
export const IconCalendar = (p: P) => (
  <Icon {...p}>
    <rect x="4" y="5.5" width="16" height="14" rx="2" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </Icon>
);
export const IconSparkle = (p: P) => (
  <Icon {...p}>
    <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8Z" />
    <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
  </Icon>
);
export const IconPencil = (p: P) => (
  <Icon {...p}>
    <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5Z" />
    <path d="M13.5 7l3 3" />
  </Icon>
);
export const IconRepeat = (p: P) => (
  <Icon {...p}>
    <path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3" />
  </Icon>
);
export const IconUsers = (p: P) => (
  <Icon {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 19.5a6.5 6.5 0 0 1 13 0" />
    <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14a6.5 6.5 0 0 1 3.5 5.5" />
  </Icon>
);
export const IconBookmark = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Icon {...p}>
    <path d="M6.5 4h11v16l-5.5-4-5.5 4Z" fill={filled ? 'currentColor' : 'none'} />
  </Icon>
);
export const IconGrowth = (p: P) => (
  <Icon {...p}>
    <path d="M5 20V14M10 20V10M15 20V12M20 20V5" />
  </Icon>
);
