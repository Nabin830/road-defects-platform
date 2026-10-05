import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { reverseGeocode } from '../lib/geocode';
import {
  fingerprint, stampLines, stampPhoto, canUseLiveCamera,
  MAX_GPS_ACCURACY_M, WEAK_GPS_M, type GpsFix, type PhotoEvidence, type PhotoPlace,
} from '../lib/evidence';
import { metres, errorMessage } from '../lib/utils';
import { IconCamera, IconX, IconCrosshair } from '../lib/icons';

/** A phone camera photo from the fallback picker counts as live only if it was taken in the last 2 minutes. */
const FRESH_MS = 2 * 60 * 1000;

interface Props {
  place?: PhotoPlace | null;
  /** Phones: no photo until there's a good GPS fix. */
  requireGps: boolean;
  onCapture: (photo: PhotoEvidence) => void;
  onClose: () => void;
}

/** Full-screen live camera. The photo is stamped with time, GPS and address the moment it's taken. */
export function CameraCapture({ place, requireGps, onCapture, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const nativeInput = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState(canUseLiveCamera() ? '' : "This browser can't show a live camera here.");
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [address, setAddress] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const geocodedAt = useRef<GpsFix | null>(null);

  // Camera
  useEffect(() => {
    if (!canUseLiveCamera()) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
    }).then(s => {
      if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
      stream = s;
      if (video.current) { video.current.srcObject = s; void video.current.play().catch(() => {}); }
    }).catch((e: unknown) => {
      const name = (e as { name?: string })?.name;
      setCamError(name === 'NotAllowedError'
        ? 'Camera permission is blocked. Allow the camera for this site in your browser settings.'
        : name === 'NotFoundError' ? 'No camera was found on this device.'
        : errorMessage(e, "The camera couldn't be started."));
    });
    return () => { cancelled = true; stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  // GPS, live while the camera is open
  useEffect(() => {
    if (!('geolocation' in navigator)) { setGpsError('This device has no location service.'); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => { setGpsError(''); setFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); },
      (err) => setGpsError(err.code === err.PERMISSION_DENIED
        ? 'Location permission is blocked. Allow location for this site in your browser settings.'
        : 'Still looking for GPS…'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Street address for the stamp — looked up again only after moving 25 m
  useEffect(() => {
    if (!fix) return;
    const last = geocodedAt.current;
    if (last && metres(last.lat, last.lng, fix.lat, fix.lng) < 25) return;
    geocodedAt.current = fix;
    const ctrl = new AbortController();
    reverseGeocode(fix.lat, fix.lng, ctrl.signal).then(a => { if (a) setAddress(a); }).catch(() => {});
    return () => ctrl.abort();
  }, [fix]);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  // Escape closes the camera only, not a dialog underneath it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const gpsOk = !!fix && fix.accuracy <= MAX_GPS_ACCURACY_M;
  const canShoot = !busy && (!requireGps || gpsOk);

  async function finish(src: CanvasImageSource, w: number, h: number) {
    const when = new Date();
    const out = await stampPhoto(src, w, h, stampLines({ when, source: 'camera', fix, address, place }));
    onCapture({
      file: out,
      meta: {
        photo_source: 'camera', photo_hash: fingerprint(src, w, h), photo_taken_at: when.toISOString(),
        photo_lat: fix?.lat ?? null, photo_lng: fix?.lng ?? null, photo_accuracy: fix ? Math.round(fix.accuracy) : null,
      },
    });
  }

  async function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth || !canShoot) return;
    setBusy(true); setError('');
    try {
      // Freeze one frame so the fingerprint and the saved photo are the same picture
      const frame = document.createElement('canvas');
      frame.width = v.videoWidth; frame.height = v.videoHeight;
      frame.getContext('2d')!.drawImage(v, 0, 0);
      await finish(frame, frame.width, frame.height);
    } catch (e) {
      setError(errorMessage(e, 'Could not take the photo. Please try again.'));
      setBusy(false);
    }
  }

  // Fallback: the phone's own camera app (the capture attribute skips the gallery)
  async function nativePhoto(file: File | undefined) {
    if (nativeInput.current) nativeInput.current.value = '';
    if (!file) return;
    if (Date.now() - file.lastModified > FRESH_MS) {
      return setError('Please take a new photo now. Photos from the gallery can’t be used.');
    }
    if (requireGps && !gpsOk) return setError('Wait for a GPS fix, then take the photo again.');
    setBusy(true); setError('');
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      try { await finish(bmp, bmp.width, bmp.height); } finally { bmp.close(); }
    } catch (e) {
      setError(errorMessage(e, "That photo couldn't be opened. Please try again."));
      setBusy(false);
    }
  }

  const lines = stampLines({ when: now, source: 'camera', fix, address, place });
  const gpsNote = gpsError || (!fix ? 'Finding your GPS location…'
    : fix.accuracy > MAX_GPS_ACCURACY_M ? `GPS too weak (±${Math.round(fix.accuracy)} m). Move into the open.`
    : fix.accuracy > WEAK_GPS_M ? `GPS is weak (±${Math.round(fix.accuracy)} m). Wait a moment for a better fix.`
    : `GPS locked (±${Math.round(fix.accuracy)} m)`);
  const gpsTone = !fix || gpsError || fix.accuracy > MAX_GPS_ACCURACY_M ? 'bg-rd-600' : fix.accuracy > WEAK_GPS_M ? 'bg-am-500' : 'bg-em-600';

  return createPortal(
    <div className="fixed inset-0 z-[9200] bg-black text-white flex flex-col" role="dialog" aria-modal="true" aria-label="Take a photo">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {!camError && (
          <video ref={video} playsInline muted autoPlay onLoadedMetadata={() => setReady(true)}
                 className="absolute inset-0 w-full h-full object-cover" />
        )}
        {camError && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="max-w-[360px] grid gap-3 justify-items-center">
              <IconCamera size={36} />
              <p className="text-[14px]">{camError}</p>
              <p className="text-[13px] text-white/70">You can still take a new photo with your phone's camera app.</p>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => nativeInput.current?.click()}>
                <IconCamera size={16} /> Open camera
              </button>
              <input ref={nativeInput} type="file" accept="image/*" capture="environment" className="hidden"
                     onChange={(e) => void nativePhoto(e.target.files?.[0])} />
            </div>
          </div>
        )}

        <div className="absolute top-0 inset-x-0 flex items-center justify-between gap-3 p-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full ${gpsTone}`}>
            <IconCrosshair size={13} /> {gpsNote}
          </span>
          <button type="button" onClick={onClose} aria-label="Close camera"
                  className="w-10 h-10 flex-none rounded-full bg-black/55 grid place-items-center hover:bg-black/75">
            <IconX size={18} />
          </button>
        </div>

        {/* Live preview of what gets stamped on the photo */}
        <div className="absolute bottom-0 inset-x-0 bg-black/60 px-3 py-2.5 text-[12px] leading-snug mono">
          {lines.map((l, i) => (
            <div key={i} className={`truncate ${i === 0 ? 'font-bold' : ''} ${i === lines.length - 1 ? 'text-amber-400' : ''}`}>{l}</div>
          ))}
        </div>
      </div>

      <div className="flex-none grid place-items-center gap-2 py-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        {error && <p className="text-[13px] text-red-300 px-4 text-center">{error}</p>}
        {!camError && (
          <button type="button" onClick={() => void shoot()} disabled={!ready || !canShoot} aria-label="Take photo"
                  className="w-[72px] h-[72px] rounded-full border-4 border-white grid place-items-center disabled:opacity-40">
            <span className="w-[56px] h-[56px] rounded-full bg-white" />
          </button>
        )}
        {requireGps && !gpsOk && <p className="text-[12px] text-white/70">The photo button unlocks once GPS is accurate to {MAX_GPS_ACCURACY_M} m.</p>}
      </div>
    </div>,
    document.body,
  );
}
