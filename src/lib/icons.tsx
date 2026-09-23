import type { SVGProps } from 'react';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
  strokeWidth?: number;
}

function make(paths: string) {
  return function Icon({ size = 17, strokeWidth = 1.8, ...rest }: IconProps) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}
           dangerouslySetInnerHTML={{ __html: paths }} />
    );
  };
}

export const IconPin        = make('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>');
export const IconPlus       = make('<path d="M5 12h14M12 5v14"/>');
export const IconCheck      = make('<path d="m20 6-11 11-5-5"/>');
export const IconCheckCircle= make('<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>');
export const IconClock      = make('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
export const IconAlert      = make('<path d="m10.3 3.9-8.2 14A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-3.1l-8.2-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>');
export const IconCamera     = make('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.2"/>');
export const IconSearch     = make('<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3"/>');
export const IconFilter     = make('<path d="M22 4H2l8 9.5V20l4 1.5v-8L22 4Z"/>');
export const IconRight      = make('<path d="m9 18 6-6-6-6"/>');
export const IconDown       = make('<path d="m6 9 6 6 6-6"/>');
export const IconLeft       = make('<path d="m15 18-6-6 6-6"/>');
export const IconUser       = make('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>');
export const IconUsers      = make('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.1a4 4 0 0 1 0 7.75"/>');
export const IconLogout     = make('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>');
export const IconHome       = make('<path d="m3 9.5 9-7 9 7V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V13h6v9"/>');
export const IconList       = make('<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>');
export const IconChart      = make('<path d="M3 3v18h18"/><path d="M7.5 16v-5M12 16V7M16.5 16v-3"/>');
export const IconUpload     = make('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>');
export const IconX          = make('<path d="M18 6 6 18M6 6l12 12"/>');
export const IconMenu       = make('<path d="M4 6h16M4 12h16M4 18h16"/>');
export const IconSun        = make('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>');
export const IconMoon       = make('<path d="M12 3a6.4 6.4 0 0 0 9 9 9 9 0 1 1-9-9Z"/>');
export const IconArrow      = make('<path d="M5 12h14m-7-7 7 7-7 7"/>');
export const IconShield     = make('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>');
export const IconTruck      = make('<path d="M14 18V6a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h2"/><path d="M14 9h4l4 4v4a1 1 0 0 1-1 1h-1"/><circle cx="6.5" cy="18" r="2"/><circle cx="18.5" cy="18" r="2"/>');
export const IconTrend      = make('<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>');
export const IconMail       = make('<rect x="2" y="4.5" width="20" height="15" rx="2"/><path d="m22 6.5-10 6-10-6"/>');
export const IconLock       = make('<rect x="3.5" y="11" width="17" height="10.5" rx="2"/><path d="M7.5 11V7a4.5 4.5 0 0 1 9 0v4"/>');
export const IconEye        = make('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>');
export const IconStar       = make('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/>');
export const IconActivity   = make('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>');
export const IconCrosshair  = make('<circle cx="12" cy="12" r="9"/><path d="M22 12h-4M6 12H2M12 6V2M12 22v-4"/>');
export const IconMap        = make('<path d="m3 6.5 6-3 6 3 6-3v14l-6 3-6-3-6 3Z"/><path d="M9 3.5v14M15 6.5v14"/>');
export const IconGrid       = make('<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>');
export const IconTable      = make('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9.5 10v10"/>');
export const IconBell       = make('<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>');
export const IconFile       = make('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>');
export const IconDownload   = make('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>');
export const IconWrench     = make('<path d="M14.7 6.3a4.5 4.5 0 0 0 5.9 5.9l-8.3 8.3a2.8 2.8 0 0 1-4-4Z"/>');
export const IconBuilding   = make('<path d="M4 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M16 9h3a2 2 0 0 1 2 2v11M2 22h20M8 6h.01M12 6h.01M8 10h.01M12 10h.01M8 14h.01M12 14h.01"/>');
export const IconFlag       = make('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><path d="M4 22v-7"/>');
export const IconSend       = make('<path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z"/>');
