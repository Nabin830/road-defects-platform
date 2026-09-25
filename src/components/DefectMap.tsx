import { lazy, Suspense } from 'react';
import type { MapProps } from './LeafletMap';

// The map library is ~150 KB, so it loads after the page has painted instead of blocking it
const LeafletMap = lazy(() => import('./LeafletMap').then(m => ({ default: m.DefectMap })));

/** Interactive defect map. Shows a same-sized placeholder while the map code loads (no layout jump). */
export function DefectMap(props: MapProps) {
  const height = props.height ?? 400;
  return (
    <Suspense fallback={
      <div className="rounded-card border border-border bg-bg-alt grid place-items-center text-[13px] text-muted" style={{ height }}
           role="img" aria-label="Map loading">Loading map…</div>
    }>
      <LeafletMap {...props} />
    </Suspense>
  );
}
