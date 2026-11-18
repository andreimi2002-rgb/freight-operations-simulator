import type { SVGProps } from 'react';

/** Small line icons in the spirit of SF Symbols (drawn for this app). */
type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
});

export const IconMap = (p: P) => (
  <svg {...base(p)}><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" /><path d="M9 4v14M15 6v14" /></svg>
);
export const IconBox = (p: P) => (
  <svg {...base(p)}><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /><path d="m7.8 5.3 8.4 4.5" /></svg>
);
export const IconGauge = (p: P) => (
  <svg {...base(p)}><path d="M4.2 17.5a9 9 0 1 1 15.6 0" /><path d="m12 13 4-5" /><circle cx="12" cy="13" r="1.4" fill="currentColor" /></svg>
);
export const IconSparkle = (p: P) => (
  <svg {...base(p)}><path d="M12 3c.6 4.2 2.6 6.2 6.8 6.8-4.2.6-6.2 2.6-6.8 6.8-.6-4.2-2.6-6.2-6.8-6.8C9.4 9.2 11.4 7.2 12 3Z" /><path d="M18.5 15.5c.3 1.7 1 2.4 2.5 2.7-1.5.3-2.2 1-2.5 2.7-.3-1.7-1-2.4-2.5-2.7 1.5-.3 2.2-1 2.5-2.7Z" /></svg>
);
export const IconBook = (p: P) => (
  <svg {...base(p)}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /><path d="M8 7h8" /></svg>
);
export const IconChart = (p: P) => (
  <svg {...base(p)}><path d="M4 20h16" /><rect x="5.5" y="11" width="3" height="6" rx="1" /><rect x="10.5" y="7" width="3" height="10" rx="1" /><rect x="15.5" y="4" width="3" height="13" rx="1" /></svg>
);
export const IconGear = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
);
export const IconMore = (p: P) => (
  <svg {...base(p)}><circle cx="5.5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="18.5" cy="12" r="1.3" fill="currentColor" /></svg>
);
export const IconLocate = (p: P) => (
  <svg {...base(p)}><path d="M20.5 3.5 3.5 10.6l7.2 2.7 2.7 7.2 7.1-17Z" /></svg>
);
export const IconCompass = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></svg>
);
export const IconCube = (p: P) => (
  <svg {...base(p)}><path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /></svg>
);
export const IconPlus = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconMinus = (p: P) => (<svg {...base(p)}><path d="M5 12h14" /></svg>);
export const IconMic = (p: P) => (
  <svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
);
export const IconStop = (p: P) => (<svg {...base(p)}><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" /></svg>);
export const IconSend = (p: P) => (<svg {...base(p)}><path d="M12 19V5M6 11l6-6 6 6" /></svg>);
export const IconSpeaker = (p: P) => (
  <svg {...base(p)}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></svg>
);
export const IconSpeakerOff = (p: P) => (
  <svg {...base(p)}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></svg>
);
export const IconChevron = (p: P) => (<svg {...base(p)} strokeWidth={2.4}><path d="m9 5 7 7-7 7" /></svg>);
export const IconBack = (p: P) => (<svg {...base(p)} strokeWidth={2.4}><path d="m15 5-7 7 7 7" /></svg>);
export const IconClose = (p: P) => (<svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IconSearch = (p: P) => (<svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>);
export const IconFuel = (p: P) => (
  <svg {...base(p)}><path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20M4 20h11M5 10h9" /><path d="M14 8h1.5a2 2 0 0 1 2 2v5.5a1.5 1.5 0 0 0 3 0V8.5L18 6" /></svg>
);
export const IconClock = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const IconFlag = (p: P) => (<svg {...base(p)}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>);
export const IconRoute = (p: P) => (
  <svg {...base(p)}><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8 18h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16" /></svg>
);
export const IconWarn = (p: P) => (
  <svg {...base(p)}><path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" /><path d="M12 9.5v4.5M12 17.5v.01" /></svg>
);
export const IconInfo = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.8v.01" /></svg>);
export const IconBolt = (p: P) => (<svg {...base(p)}><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" /></svg>);
export const IconMoney = (p: P) => (<svg {...base(p)}><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v.01M18 14.5v.01" /></svg>);
export const IconWeight = (p: P) => (<svg {...base(p)}><path d="M6.5 8h11l2.5 12H4L6.5 8Z" /><circle cx="12" cy="5.5" r="2" /></svg>);
export const IconBed = (p: P) => (<svg {...base(p)}><path d="M3 18V7M3 14h18v4M21 14v-2.5A2.5 2.5 0 0 0 18.5 9H11v5" /><circle cx="7" cy="11" r="1.8" /></svg>);
export const IconToll = (p: P) => (<svg {...base(p)}><path d="M4 21V9h5v12M9 12h11M4 9l2.5-5L9 9" /></svg>);
export const IconShip = (p: P) => (<svg {...base(p)}><path d="M3 16.5 5 20h14l2-3.5H3ZM6 16.5V11h12v5.5M12 11V5M9 7.5h6" /></svg>);
export const IconCheck = (p: P) => (<svg {...base(p)} strokeWidth={2.2}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const IconTruck = (p: P) => (
  <svg {...base(p)}><path d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3.5v3h-7" /><circle cx="6.5" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>
);
export const IconLink = (p: P) => (
  <svg {...base(p)}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
);
export const IconTrash = (p: P) => (<svg {...base(p)}><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" /></svg>);
export const IconMoon = (p: P) => (<svg {...base(p)}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>);
export const IconBuilding = (p: P) => (<svg {...base(p)}><path d="M4 21V5l8-2v18M12 8h8v13M3 21h18M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2" /></svg>);
export const IconPin = (p: P) => (<svg {...base(p)}><path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></svg>);
