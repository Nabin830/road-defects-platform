import { useState, type ReactNode, type ImgHTMLAttributes } from 'react';

/** An <img> that swaps to `fallback` (or nothing) if the photo can't be loaded — no broken-image icons. */
export function Photo({ fallback = null, ...img }: ImgHTMLAttributes<HTMLImageElement> & { fallback?: ReactNode }) {
  const [broken, setBroken] = useState(false);
  if (broken || !img.src) return <>{fallback}</>;
  return <img {...img} onError={() => setBroken(true)} />;
}

/** Neutral box shown where a photo should be but couldn't load. */
export function PhotoMissing({ className = '' }: { className?: string }) {
  return <div className={`grid place-items-center bg-bg-alt text-[12.5px] text-muted ${className}`}>Photo unavailable</div>;
}
