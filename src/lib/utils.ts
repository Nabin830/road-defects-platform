import { HAS_SUPABASE } from './supabase';

/** A readable message from anything that was thrown (Error, Supabase error object, string…). */
export function errorMessage(err: unknown, fallback = 'Please try again.'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err && 'message' in err && typeof (err).message === 'string') {
    return (err as { message: string }).message || fallback;
  }
  return typeof err === 'string' && err ? err : fallback;
}

const PHOTO_PATH = '/storage/v1/object/public/defect-photos/';
const SUPABASE_ORIGIN = (() => {
  try { return new URL(import.meta.env.VITE_SUPABASE_URL).origin; } catch { return null; }
})();

/** Photo links come from the database, so never trust them blindly. On the live site only photos in
 *  this project's own RoadFix bucket are shown — never a "javascript:" link (it would run code when
 *  clicked) or a picture from another website made to look like a RoadFix photo. Demo mode also
 *  allows blob and same-site addresses. */
export function safePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!HAS_SUPABASE) return /^(https?:\/\/|blob:|\/(?!\/))/i.test(u) ? u : null;
  try {
    const parsed = new URL(u);   // resolves "../" so the folder check can't be dodged
    return parsed.origin === SUPABASE_ORIGIN && parsed.pathname.startsWith(PHOTO_PATH) ? u : null;
  } catch { return null; }
}

/** True when a request failed because there was no connection (not because the server refused it). */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|network connection was lost|internet connection appears to be offline/i
    .test(errorMessage(err, ''));
}

export function relativeTime(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
  const d = Math.floor(s / 86400);
  if (d === 1) return 'Yesterday';
  if (d < 7) return d + ' days ago';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function daysAgo(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
}

export function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function initialsOf(name: string): string {
  return (name || 'U').split(/\s+/).map(s => s[0] || '').slice(0, 2).join('').toUpperCase();
}

export function newDefectId(): string {
  // Timestamp (base36, seconds precision) + short random suffix — collision-safe
  // for a live multi-user app, unlike a 3-digit random number.
  const t = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `RD-${t}${r}`;
}

/** Distance in metres between two lat/lng points. */
export function metres(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Turn-by-turn directions to a spot — opens the Google Maps app when installed (Android and iPhone), otherwise the website. */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** "350 m" / "4.2 km" */
export function distanceLabel(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}
