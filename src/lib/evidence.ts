/** Photo evidence: live-camera capture metadata, the burned-in info stamp, and the "fingerprint"
 *  the database uses to spot a photo that was already used on another report.
 *  Checks are repeated by the database (check_photo_evidence in supabase/Database.sql). */
import { metres } from './utils';

/** Worst GPS accuracy a phone may take a report photo with. */
export const MAX_GPS_ACCURACY_M = 100;
/** Accuracy above this is shown as a weak signal (and flagged for council above 50 m by the database). */
export const WEAK_GPS_M = 30;
/** How far a report photo may be taken from the reported spot. Must match the database. */
export const MAX_PHOTO_DISTANCE_M = 150;

export type PhotoSource = 'camera' | 'upload';

/** Everything saved alongside a photo so council can check it. */
export interface PhotoMeta {
  photo_source: PhotoSource;
  photo_hash: string;                // 64-bit perceptual fingerprint, 16 hex chars
  photo_taken_at: string | null;     // device clock when the shutter was pressed (camera only)
  photo_lat: number | null;
  photo_lng: number | null;
  photo_accuracy: number | null;     // GPS accuracy in metres
}

export interface PhotoEvidence { file: File; meta: PhotoMeta; }

/** A known place the photo belongs to — the report pin, or the defect a contractor is working on. */
export interface PhotoPlace { lat: number; lng: number; label?: string; ref?: string; }

export interface GpsFix { lat: number; lng: number; accuracy: number; }

/** Phones and tablets (camera only). Laptops and desktops may also upload a file. */
export function isMobileDevice(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  if (nav.userAgentData?.mobile) return true;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobi/i.test(ua)) return true;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;   // iPadOS asks for the desktop site
  // Touch-only screen with no mouse or trackpad (catches "request desktop site")
  return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
}

export const canUseLiveCamera = () => !!navigator.mediaDevices?.getUserMedia;

/** dHash of the top 75% of the image (the bottom is where the info stamp goes, so stamped and
 *  unstamped copies of one photo still match). Near-identical photos differ by only a few bits. */
export function fingerprint(src: CanvasImageSource, width: number, height: number): string {
  const c = document.createElement('canvas');
  c.width = 9; c.height = 8;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, width, Math.round(height * 0.75), 0, 0, 9, 8);
  const px = ctx.getImageData(0, 0, 9, 8).data;
  const grey = (x: number, y: number) => { const i = (y * 9 + x) * 4; return px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114; };
  let hex = '';
  for (let y = 0; y < 8; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) byte = (byte << 1) | (grey(x, y) > grey(x + 1, y) ? 1 : 0);
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export const stampTime = (d: Date) =>
  d.toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });

/** The lines burned into the bottom of the photo. */
export function stampLines(o: { when: Date; source: PhotoSource; fix: GpsFix | null; address: string | null; place?: PhotoPlace | null }): string[] {
  const { when, source, fix, address, place } = o;
  const lines: string[] = [];
  if (source === 'camera') {
    lines.push(address || place?.label || 'Address not found');
    lines.push(fix ? `${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)}  ·  GPS ±${Math.round(fix.accuracy)} m` : 'No GPS fix');
    lines.push(stampTime(when));
    let tag = 'RoadFix · Live camera photo';
    if (fix && place?.ref) tag += ` · ${Math.round(metres(fix.lat, fix.lng, place.lat, place.lng))} m from ${place.ref}`;
    lines.push(tag);
  } else {
    lines.push(place?.label || 'Location not given');
    if (place) lines.push(`${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}  ·  location picked on the map`);
    lines.push(`Uploaded ${stampTime(when)}`);
    lines.push('RoadFix · Uploaded from a computer — not a live camera photo');
  }
  return lines;
}

/** Draws the photo (longest side ≤ maxSide) with an info band along the bottom, as a JPEG. */
export async function stampPhoto(src: CanvasImageSource, width: number, height: number, lines: string[], maxSide = 2000): Promise<File> {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.round(width * scale), h = Math.round(height * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);

  const size = Math.max(14, Math.round(Math.min(w, h) / 34));
  const pad = Math.round(size * 0.8), lineH = Math.round(size * 1.35);
  const band = pad * 2 + lineH * lines.length;
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, h - band, w, band);
  ctx.textBaseline = 'top';
  lines.forEach((text, i) => {
    ctx.font = `${i === 0 ? 700 : 500} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = i === lines.length - 1 ? '#fbbf24' : '#fff';
    ctx.fillText(fit(ctx, text, w - pad * 2), pad, h - band + pad + i * lineH);
  });

  const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Could not save the photo. Please try again.');
  return new File([blob], `roadfix-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

/** A file chosen from the computer: fingerprint it and stamp it clearly as an upload. */
export async function prepareUpload(file: File, place: PhotoPlace | null): Promise<PhotoEvidence> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    .catch(() => { throw new Error("That photo couldn't be opened. Try a JPEG or PNG."); });
  try {
    const photo_hash = fingerprint(bmp, bmp.width, bmp.height);
    const out = await stampPhoto(bmp, bmp.width, bmp.height,
      stampLines({ when: new Date(), source: 'upload', fix: null, address: null, place }));
    return {
      file: out,
      meta: { photo_source: 'upload', photo_hash, photo_taken_at: null, photo_lat: null, photo_lng: null, photo_accuracy: null },
    };
  } finally { bmp.close(); }
}

/** What each database flag means, for council. */
export const PHOTO_FLAG_LABEL: Record<string, string> = {
  uploaded: 'Uploaded from a computer, not taken live with the camera',
  reused_photo: 'Looks the same as a photo already used on another report',
  weak_gps: 'GPS signal was weak when the photo was taken (over 50 m)',
  no_gps: 'No GPS location was recorded with the photo',
  far_from_pin: `Photo was taken more than ${MAX_PHOTO_DISTANCE_M} m from the reported spot`,
  far_from_defect: `Photo was taken more than ${MAX_PHOTO_DISTANCE_M} m from the defect`,
  clock_mismatch: "The phone's clock didn't match the server time when it was sent",
};
