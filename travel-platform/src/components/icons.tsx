import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const IconPlane = (p: P) => <Svg {...p}><path d="M10.5 13.5 3 11l1.5-1.5 7.5 1L16.5 6c.8-.8 2.2-.8 3 0s.8 2.2 0 3L15 13.5l1 7.5-1.5 1.5-2.5-7.5-3 3V21l-1.5 1-1-3.5L3 17.5 4 16h3l3.5-2.5Z" /></Svg>;
export const IconBed = (p: P) => <Svg {...p}><path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 11.5a1.5 1.5 0 1 0 0-.01" /></Svg>;
export const IconCar = (p: P) => <Svg {...p}><path d="M5 16h14M6.5 16v2M17.5 16v2M4 16v-4l2-5h12l2 5v4M4 12h16M7.5 13.5h.01M16.5 13.5h.01" /></Svg>;
export const IconBoat = (p: P) => <Svg {...p}><path d="M3 17c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0M5 14l-1-4h16l-2 4M12 10V4l5 4h-5" /></Svg>;
export const IconTrain = (p: P) => <Svg {...p}><path d="M7 3h10a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2ZM5 10h14M8 21l2-4M16 21l-2-4M8.5 13.5h.01M15.5 13.5h.01" /></Svg>;
export const IconSparkle = (p: P) => <Svg {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16Z" /></Svg>;
export const IconQuestion = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01" /></Svg>;
export const IconHeart = ({ filled, ...p }: P & { filled?: boolean }) => <Svg {...p} fill={filled ? "currentColor" : "none"}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></Svg>;
export const IconBack = (p: P) => <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>;
export const IconChevron = (p: P) => <Svg {...p}><path d="M9 5l7 7-7 7" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const IconX = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const IconAlert = (p: P) => <Svg {...p}><path d="M12 4 2.8 19.5h18.4L12 4ZM12 10v4.5M12 17h.01" /></Svg>;
export const IconInfo = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>;
export const IconCalendar = (p: P) => <Svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>;
export const IconUsers = (p: P) => <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></Svg>;
export const IconSearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Svg>;
export const IconCompass = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></Svg>;
export const IconSuitcase = (p: P) => <Svg {...p}><rect x="3.5" y="7" width="17" height="13" rx="2" /><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M3.5 12.5h17" /></Svg>;
export const IconClock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const IconShield = (p: P) => <Svg {...p}><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3Z" /><path d="m9 12 2 2 4-4" /></Svg>;
export const IconMinus = (p: P) => <Svg {...p}><path d="M5 12h14" /></Svg>;
export const IconPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconFlask = (p: P) => <Svg {...p}><path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7.5 15h9" /></Svg>;
export const IconMap = (p: P) => <Svg {...p}><path d="m9 4-5.5 2v14L9 18l6 2 5.5-2V4L15 6 9 4ZM9 4v14M15 6v14" /></Svg>;
export const IconDownload = (p: P) => <Svg {...p}><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></Svg>;
