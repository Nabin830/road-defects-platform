import { useUI } from '../store/ui';
import logoBlack from '../assets/logo-black.webp';
import logoWhite from '../assets/logo-white.webp';
import logoBlack1x from '../assets/logo-black-1x.webp';
import logoWhite1x from '../assets/logo-white-1x.webp';

/** RoadFix lockup (icon + wordmark) on a transparent background, swapped for the active theme. */
export function BrandLogo({ className = 'h-8' }: { className?: string }) {
  const theme = useUI(s => s.theme);
  // width/height give the browser the shape up front, so nothing jumps while the logo loads
  const [x1, x2] = theme === 'dark' ? [logoWhite1x, logoWhite] : [logoBlack1x, logoBlack];
  // 1x for normal screens, 2x for sharp phone/retina screens
  return <img src={x1} srcSet={`${x1} 1x, ${x2} 2x`} alt="RoadFix" width={287} height={56} decoding="async"
              className={`w-auto ${className}`} />;
}
