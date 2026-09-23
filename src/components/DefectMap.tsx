import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import type { Defect } from '../lib/types';
import { SEVERITY, STATUS, ORANGE } from '../lib/constants';

interface Props {
  defects: Defect[];
  height?: number | string;
  onPick?: (lat: number, lng: number) => void;   // if set, clicking places a pin
  pickedLat?: number | null;
  pickedLng?: number | null;
  legend?: boolean;
}

export function DefectMap({ defects, height = 400, onPick, pickedLat, pickedLng, legend = true }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const pickMarkerRef = useRef<L.Marker | null>(null);
  const nav = useNavigate();

  // init
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = L.map(boxRef.current, { zoomControl: true, attributionControl: true }).setView([ORANGE.lat, ORANGE.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    if (onPick) {
      map.on('click', (e: L.LeafletMouseEvent) => onPick(e.latlng.lat, e.latlng.lng));
    }
    // ensure size after mount
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // repaint pins
  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    for (const d of defects) {
      const color = d.status === 'completed' ? '#94A3B8' : SEVERITY[d.severity].color;
      const icon = L.divIcon({
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 26],
        popupAnchor: [0, -24],
        html: `<div class="pin pin-drop"><b style="background:${color}"></b><em></em></div>`,
      });
      const marker = L.marker([d.latitude, d.longitude], { icon }).addTo(layer);
      const popup = `
        <div style="padding:10px 12px;display:grid;gap:7px;min-width:200px">
          <div style="font-weight:700;font-size:13.5px;color:var(--ink);line-height:1.3">${escapeHtml(d.title)}</div>
          <div style="font-size:11.5px;color:var(--muted)">${escapeHtml(d.road)}</div>
          <div style="display:flex;align-items:center;gap:8px;font-size:11.5px">
            <span style="padding:2px 8px;border-radius:999px;background:var(--surface-2);color:var(--ink-2);font-weight:600">${STATUS[d.status].label}</span>
            <span style="color:${color};font-weight:700">${SEVERITY[d.severity].label}</span>
          </div>
          <a href="#/defect/${d.id}" style="font-size:12px;font-weight:700;color:#1E40AF">View details →</a>
        </div>`;
      marker.bindPopup(popup, { maxWidth: 250 });
      marker.on('click', () => marker.openPopup());
      const link = marker.getPopup()?.getElement()?.querySelector('a');
      if (link) link.addEventListener('click', (ev) => { ev.preventDefault(); nav(`/defect/${d.id}`); });
    }
    // Auto-fit if we have defects
    if (defects.length > 0) {
      const bounds = L.latLngBounds(defects.map(d => [d.latitude, d.longitude] as [number, number]));
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [defects, nav]);

  // picked-pin overlay for the report form
  useEffect(() => {
    const map = mapRef.current;
    if (!map || pickedLat == null || pickedLng == null) return;
    if (pickMarkerRef.current) pickMarkerRef.current.remove();
    const icon = L.divIcon({
      className: '', iconSize: [30, 30], iconAnchor: [15, 30],
      html: `<div class="pin pin-drop" style="width:30px;height:30px"><b style="background:#1E40AF"></b><em></em></div>`,
    });
    pickMarkerRef.current = L.marker([pickedLat, pickedLng], { icon }).addTo(map);
    map.panTo([pickedLat, pickedLng]);
  }, [pickedLat, pickedLng]);

  return (
    <div className="relative rounded-card overflow-hidden border border-border bg-bg-alt" style={{ height }}>
      <div ref={boxRef} className="absolute inset-0" />
      {legend && (
        <div className="absolute left-2.5 bottom-6 z-[410] p-2.5 grid gap-1.5 bg-surface/95 border border-border rounded-lg shadow-md text-[11px] font-semibold text-ink-2 pointer-events-none">
          {(['critical', 'high', 'medium', 'low'] as const).map(s => (
            <div key={s} className="flex items-center gap-2">
              <i className="w-2.5 h-2.5 rounded-full block" style={{ background: SEVERITY[s].color }} />
              {SEVERITY[s].label}
            </div>
          ))}
          <div className="flex items-center gap-2">
            <i className="w-2.5 h-2.5 rounded-full block bg-slate-400" />
            Completed
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
