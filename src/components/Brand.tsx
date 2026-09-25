import { useUI } from '../store/ui';
import logoBlack from '../Logos/logo-transparent-black-trimmed.png';
import logoWhite from '../Logos/logo-transparent-white-trimmed.png';

/** RoadFix lockup (icon + wordmark) on a transparent background, swapped for the active theme. */
export function BrandLogo({ className = 'h-8' }: { className?: string }) {
  const theme = useUI(s => s.theme);
  return <img src={theme === 'dark' ? logoWhite : logoBlack} alt="RoadFix" className={`w-auto ${className}`} />;
}
