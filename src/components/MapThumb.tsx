import { SEVERITY } from '../lib/constants';
import type { Severity } from '../lib/types';

const TILE = 256;

/** Static street-map preview centred on a point: a 3×3 block of OpenStreetMap tiles, no Leaflet needed. */
export function MapThumb({ lat, lng, severity, label, zoom = 16, className = '' }: {
  lat: number; lng: number; severity: Severity; label: string; zoom?: number; className?: string;
}) {
  // Web-Mercator: world pixel position of the point at this zoom
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n * TILE;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * TILE;
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  const offX = x - tx * TILE, offY = y - ty * TILE;   // point's position inside its own tile

  const tiles = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const sub = 'abc'[(tx + dx + ty + dy + 3) % 3];
      tiles.push(
        <img key={`${dx},${dy}`} alt="" draggable={false} loading="lazy"
             src={`https://${sub}.tile.openstreetmap.org/${zoom}/${(tx + dx + n) % n}/${ty + dy}.png`}
             className="absolute max-w-none select-none" width={TILE} height={TILE}
             style={{ left: `calc(50% + ${dx * TILE - offX}px)`, top: `calc(50% + ${dy * TILE - offY}px)` }} />,
      );
    }
  }

  return (
    <div className={`overflow-hidden bg-bg-alt ${className}`} role="img" aria-label={`Map of ${label}`}>
      <div className="absolute inset-0">{tiles}</div>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none">
        <span className="pin block" style={{ width: 26, height: 26 }}>
          <b style={{ background: SEVERITY[severity].color }} /><em />
        </span>
      </span>
      <span className="absolute left-2 bottom-2 text-[10.5px] font-semibold px-2 py-0.5 rounded glass text-muted border border-border">
        No photo · map view
      </span>
    </div>
  );
}
