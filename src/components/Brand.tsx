import { useUI } from '../store/ui';
import logoBlack from '../Logos/logo-transparent-black-trimmed.png';
import logoWhite from '../Logos/logo-transparent-white-trimmed.png';
import logoLight from '../Logos/logo-light.png';
import logoDark from '../Logos/logo-dark.png';

/** RoadFix lockup (icon + wordmark) on a transparent background, swapped for the active theme. */
export function BrandLogo({ className = 'h-8' }: { className?: string }) {
  const theme = useUI(s => s.theme);
  return <img src={theme === 'dark' ? logoWhite : logoBlack} alt="RoadFix" className={`w-auto ${className}`} />;
}

/** RoadFix lockup on its own solid light/dark panel, swapped for the active theme. */
export function BrandBanner({ className = '' }: { className?: string }) {
  const theme = useUI(s => s.theme);
  return <img src={theme === 'dark' ? logoDark : logoLight} alt="RoadFix" className={`w-full h-auto ${className}`} />;
}
