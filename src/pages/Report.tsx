import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { reverseGeocode, searchAddress, type PlaceResult } from '../lib/geocode';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { DefectMap } from '../components/DefectMap';
import { TYPES, SEVERITY, inCouncilArea } from '../lib/constants';
import { IconSearch, IconCrosshair, IconLeft, IconRight, IconCheck, IconAlert, IconLock } from '../lib/icons';
import type { Defect, DefectType, Severity } from '../lib/types';
import { SeverityChip } from '../components/Severity';
import { StatusBadge } from '../components/Badge';
import { useSeo } from '../lib/seo';
import { errorMessage, isNetworkError, metres, newDefectId } from '../lib/utils';
import { PhotoField } from '../components/PhotoField';
import { isMobileDevice, MAX_GPS_ACCURACY_M, MAX_PHOTO_DISTANCE_M, type PhotoEvidence } from '../lib/evidence';
import { saveToOutbox, useOutbox } from '../lib/outbox';

const NEARBY_M = 150;

/** Address placeholder used when the street name can't be looked up (no internet). */
const nearLabel = (lat: number, lng: number) => `Near ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
const isNearLabel = (s: string) => /^Near -?\d/.test(s);

// Must match the database (check_report_text in supabase/Database.sql), which enforces the same limits
const TITLE_MIN = 8, TITLE_MAX = 100, DESC_MIN = 20, DESC_MAX = 2000;

/** Rejects keyboard mashing like "ghh" / "aaaaaaa": needs real words, not one repeated character. */
function looksReal(text: string, min: number) {
  const t = text.trim();
  if (t.length < min) return false;
  const letters = t.replace(/[^a-z]/gi, '');
  if (letters.length < 4) return false;
  if (new Set(letters.toLowerCase()).size < 3) return false;
  return /\s/.test(t) || t.length >= 12;
}

export function ReportPage() {
  useSeo({ title: 'Report a road defect', noindex: true });
  const nav = useNavigate();
  const { userId } = useAuth();
  const { toast } = useUI();

  const [step, setStep] = useState(1);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [place, setPlace] = useState('');
  const [locating, setLocating] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const placeAuto = useRef(true);   // true while the road field holds an address we filled in (not typed by the user)
  const watchId = useRef<number | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [type, setType] = useState<DefectType | ''>('');
  const [sev, setSev] = useState<Severity | ''>('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [photo, setPhoto] = useState<PhotoEvidence | null>(null);
  const [busy, setBusy] = useState(false);
  // Phones: location comes from GPS only and the photo from the live camera, so neither can be faked by hand
  const mobile = useMemo(isMobileDevice, []);
  const [existing, setExisting] = useState<Defect[]>([]);
  const online = useOutbox(s => s.online);

  useEffect(() => { api.listDefects({}).then(setExisting).catch(() => {}); }, []);

  // Open reports close to the chosen spot — likely the same defect
  const nearby = useMemo(() => {
    if (lat == null || lng == null) return [];
    return existing
      .filter(d => d.status !== 'completed' && d.status !== 'rejected')
      .map(d => ({ d, m: metres(lat, lng, d.latitude, d.longitude) }))
      .filter(x => x.m <= NEARBY_M)
      .sort((a, b) => a.m - b.m)
      .slice(0, 3);
  }, [existing, lat, lng]);

  // Same rule as the database: an open report within 150 m from the last hour blocks a new one
  const blocking = nearby.find(({ d }) => Date.now() - new Date(d.reported_at).getTime() < 3600000) ?? null;

  const steps = ['Location', 'Details', 'Photo & submit'];

  // Look up the street address whenever the pin moves, and fill the road field unless the user typed their own
  useEffect(() => {
    if (lat == null || lng == null) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLookingUp(true);
      reverseGeocode(lat, lng, ctrl.signal)
        .then(addr => {
          if (mobile) setPlace(addr || nearLabel(lat, lng));
          else if (addr && (placeAuto.current || !place.trim())) { setPlace(addr); placeAuto.current = true; }
        })
        // No internet: phones can't type the address, so use the coordinates (looked up again when sent)
        .catch(() => { if (mobile && !ctrl.signal.aborted) setPlace(nearLabel(lat, lng)); })
        .finally(() => { if (!ctrl.signal.aborted) setLookingUp(false); });
    }, 500);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  // Address search as you type (debounced to respect the free geocoder's rate limit)
  useEffect(() => {
    if (query.trim().length < 3) { setResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setSearching(true);
      searchAddress(query, ctrl.signal)
        .then(r => { setResults(r); setSearchOpen(true); })
        .catch(() => {})
        .finally(() => { if (!ctrl.signal.aborted) setSearching(false); });
    }, 600);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  function chooseResult(r: PlaceResult) {
    setLat(r.lat); setLng(r.lng); setAccuracy(null);
    setPlace(r.label); placeAuto.current = true;
    setQuery(r.label); setSearchOpen(false);
  }

  // Warn before a refresh or tab close throws away a half-filled report
  const dirty = !busy && (lat != null || !!title.trim() || !!desc.trim() || !!photo);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => () => { if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); }, []);

  // Phones start finding the location straight away — it's the only way to set it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (mobile) locateMe(); }, []);

  // A photo belongs to the spot it was taken for — moving the pin means taking it again
  const pinKey = lat == null || lng == null ? '' : `${lat},${lng}`;
  const photoPin = useRef(pinKey);
  useEffect(() => { if (photoPin.current !== pinKey) { photoPin.current = pinKey; setPhoto(null); } }, [pinKey]);

  /** Refuses a camera photo taken too far from the reported spot. */
  function photoTooFar(p: PhotoEvidence): string | null {
    if (p.meta.photo_source !== 'camera' || lat == null || lng == null) return null;
    if (p.meta.photo_lat == null || p.meta.photo_lng == null) {
      return mobile ? 'The photo has no GPS location. Allow location and take it again.' : null;
    }
    const m = Math.round(metres(lat, lng, p.meta.photo_lat, p.meta.photo_lng));
    if (m <= MAX_PHOTO_DISTANCE_M) return null;
    return `This photo was taken ${m} m from the reported spot. Take it at the defect (within ${MAX_PHOTO_DISTANCE_M} m).`;
  }

  function pickSpot(la: number, ln: number) {
    setLat(la); setLng(ln); setAccuracy(null);
  }

  /** Watches GPS for a few seconds and keeps the most accurate fix — the first reading is often off by hundreds of metres. */
  function locateMe() {
    if (!('geolocation' in navigator)) {
      return toast('error', 'Location unavailable', 'Your browser does not support geolocation.');
    }
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    setLocating(true);
    let best: GeolocationCoordinates | null = null;

    const finish = () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      clearTimeout(timer);
      setLocating(false);
      if (!best) return;
      const acc = Math.round(best.accuracy);
      if (mobile) {
        if (acc > MAX_GPS_ACCURACY_M) toast('warning', 'GPS signal too weak', `Only accurate to about ${acc} m. Move into the open and tap "Refresh GPS location".`);
        else toast('success', 'Location found', `Accurate to about ${acc} m.`);
      } else if (acc > 100) toast('warning', 'Location is approximate', `Only accurate to about ${acc} m. Drag the pin or tap the map on the exact spot.`);
      else toast('success', 'Location found', `Accurate to about ${acc} m. Drag the pin if it's not quite right.`);
    };
    const timer = setTimeout(finish, 12000);

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (best && pos.coords.accuracy >= best.accuracy) return;
        best = pos.coords;
        setLat(best.latitude); setLng(best.longitude); setAccuracy(best.accuracy);
        if (best.accuracy <= 20) finish();
      },
      (err) => {
        if (best) return finish();
        if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
        clearTimeout(timer);
        setLocating(false);
        toast('error', 'Could not get location', err.code === err.PERMISSION_DENIED
          ? `Location permission is blocked. Allow it in your browser settings${mobile ? ' — it is needed to report from a phone.' : ', or tap the map instead.'}`
          : errorMessage(err, 'Check location permissions and try again.'));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
  }

  const titleOk = looksReal(title, TITLE_MIN) && title.trim().length <= TITLE_MAX;
  const descOk = looksReal(desc, DESC_MIN) && desc.trim().length <= DESC_MAX;

  function next() {
    if (step === 1 && (lat == null || lng == null)) {
      return toast('warning', mobile ? 'Waiting for GPS' : 'Pick a location', mobile ? 'Tap "Use my location" and allow location access.' : 'Tap on the map or use "Use my location".');
    }
    if (step === 1 && mobile && (accuracy == null || accuracy > MAX_GPS_ACCURACY_M)) {
      return toast('warning', 'GPS signal too weak', `Your location is only accurate to ${accuracy == null ? '?' : Math.round(accuracy)} m. Move into the open and tap "Use my location" again.`);
    }
    if (step === 1 && !inCouncilArea(lat!, lng!)) return toast('warning', 'Outside the service area', 'RoadFix only covers roads in Australia. Move the pin to a road in Australia.');
    if (step === 1 && blocking) return toast('warning', 'Already reported', `${blocking.d.id} was reported ${Math.round(blocking.m)} m away in the last hour. Open it and tap "Back this report" instead.`);
    if (step === 1 && !place.trim()) return toast('warning', 'Add the road name', 'Tell the crew which road or landmark it is near.');
    if (step === 2 && (!type || !sev)) return toast('warning', 'Missing details', 'Choose a type and severity.');
    if (step === 2 && !titleOk) return toast('warning', 'Add a clear title', `Describe the problem in a few words (at least ${TITLE_MIN} characters).`);
    if (step === 2 && !descOk) return toast('warning', 'Add a description', `Tell the crew what's there (at least ${DESC_MIN} characters).`);
    setStep(Math.min(3, step + 1));
  }

  async function submit() {
    if (lat == null || lng == null || !type || !sev || !titleOk || !descOk) {
      return toast('warning', 'Fill in required fields', 'Something is missing.');
    }
    if (!inCouncilArea(lat, lng)) return toast('warning', 'Outside the service area', 'Move the pin to a road in Australia.');
    if (!photo) return toast('warning', 'Add a photo', 'A photo of the defect is required so council can assess it.');
    if (mobile && photo.meta.photo_source !== 'camera') return toast('warning', 'Take a photo', 'On a phone the photo must be taken with the camera.');
    const far = photoTooFar(photo);
    if (far) return toast('warning', 'Photo is too far away', far);
    if (blocking) return toast('warning', 'Already reported', `Open ${blocking.d.id} and tap "Back this report" instead.`);
    if (!userId) return toast('warning', 'Sign in required', 'Create an account or sign in to submit a report.');
    const input = {
      title: title.trim(), description: desc.trim(), defect_type: type, severity: sev,
      road: place.trim(), latitude: lat, longitude: lng,
    };
    // One ID for this report, online or saved — so it can never be stored twice
    const id = newDefectId();
    setBusy(true);
    try {
      if (!navigator.onLine) return await keepOffline(input, id);
      let photo_url: string;
      try {
        photo_url = await api.uploadPhoto(photo.file, userId);
      } catch (err) {
        if (isNetworkError(err)) return await keepOffline(input, id);
        toast('error', 'Photo upload failed', errorMessage(err, 'Please try again. A photo is required.'));
        return;
      }
      let created;
      try {
        created = await api.createDefect({ ...input, photo_url, photo: photo.meta }, userId, { id });
      } catch (err) {
        if (isNetworkError(err)) return await keepOffline(input, id);
        void api.deletePhoto(photo_url);   // the report was refused — don't leave its photo behind
        throw err;
      }
      toast('success', `Report submitted — ${created.id}`, 'Council will review it and assign a contractor.');
      void nav('/my-reports');
    } catch (err) {
      toast('error', 'Could not submit report', errorMessage(err, 'Please try again.'));
    } finally { setBusy(false); }
  }

  /** No internet: keep the report on this phone and send it when the connection is back.
   *  Only a live camera photo with GPS qualifies — the database refuses anything else sent later. */
  async function keepOffline(input: Parameters<typeof saveToOutbox>[0]['input'], id: string) {
    if (!photo || !userId) return;
    const m = photo.meta;
    if (m.photo_source !== 'camera' || m.photo_lat == null || m.photo_lng == null || !m.photo_taken_at) {
      toast('warning', 'No internet connection', 'To save a report offline, take the photo with the camera at the defect (with GPS on). Or try again when you are connected.');
      return;
    }
    try {
      await saveToOutbox({ userId, input, meta: m, photo: photo.file, needsAddress: mobile && isNearLabel(input.road), defectId: id });
    } catch (err) {
      toast('error', 'Could not save the report', errorMessage(err, 'Please try again.'));
      return;
    }
    toast('success', 'Saved on this phone', 'No internet right now. It will be sent automatically when you are back online — keep RoadFix open or open it again later.');
    void nav('/my-reports');
  }

  return (
    <main className="w-full max-w-[900px] mx-auto px-6 py-8">
      <div className="mb-6">
        <span className="section-label">Report a defect</span>
        <h1 className="mt-1">Tell council what you saw</h1>
        <p className="text-muted mt-1">Three steps, about 60 seconds. Photos help contractors bring the right kit.</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-0 mb-8">
        {steps.map((s, i) => {
          const on = step === i + 1;
          const done = step > i + 1;
          return (
            <div key={s} className="flex items-center gap-2.5 flex-1 last:flex-none">
              <div className={`w-[30px] h-[30px] rounded-full grid place-items-center text-[12.5px] font-bold flex-none border ${done ? 'bg-em-600 text-white border-em-600' : on ? 'bg-brand text-brand-ink border-brand' : 'bg-surface-2 text-muted border-border'}`}>
                {done ? <IconCheck size={14} /> : i + 1}
              </div>
              <div className={`text-[13px] font-semibold whitespace-nowrap ${on || done ? 'text-ink' : 'text-muted'} ${on ? '' : 'hidden sm:block'}`}>{s}</div>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-3 ${done ? 'bg-em-600' : 'bg-border'}`} />}
            </div>
          );
        })}
      </div>

      {/* Step 1 — location */}
      {step === 1 && (
        <section className="card p-6">
          <h3 className="mb-2">Where is it?</h3>
          <p className="text-[13.5px] text-muted mb-5">
            {mobile
              ? 'Stand at the defect. Your location and street address come from your phone\'s GPS and can\'t be changed by hand.'
              : 'Search an address, tap the map, or use your device location. You can drag the pin to the exact spot.'}
          </p>
          {!mobile && <div className="relative mb-3">
            <label className="sr-only" htmlFor="addr-search">Search for an address</label>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><IconSearch size={16} /></span>
            <input id="addr-search" className="input !pl-9" value={query} autoComplete="off"
                   onChange={(e) => setQuery(e.target.value)} onFocus={() => results.length && setSearchOpen(true)}
                   onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                   onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) { e.preventDefault(); chooseResult(results[0]); } if (e.key === 'Escape') setSearchOpen(false); }}
                   placeholder="Search an address — e.g. 120 Summer Street, Orange" />
            {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] text-muted">Searching…</span>}
            {searchOpen && query.trim().length >= 3 && !searching && (
              <ul className="absolute z-[1000] left-0 right-0 mt-1 card shadow-lg overflow-hidden" role="listbox">
                {results.length === 0 && <li className="px-3 py-2.5 text-[13px] text-muted">No matches. Try the street name and suburb, or tap the map.</li>}
                {results.map((r, i) => (
                  <li key={i}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chooseResult(r)}
                            className="w-full text-left px-3 py-2.5 text-[13.5px] hover:bg-brand-soft border-b border-border last:border-0">
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>}
          <div className="mb-4">
            <DefectMap defects={[]} height={mobile ? 300 : 400} onPick={mobile ? undefined : pickSpot}
                       pickedLat={lat} pickedLng={lng} legend={false} />
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[220px] grid gap-1.5">
              <label className="label" htmlFor="place-field">
                Street address or landmark <span className="text-rd-600">*</span>
                {mobile && <span className="ml-2 font-normal text-muted inline-flex items-center gap-1"><IconLock size={12} /> from GPS</span>}
                {lookingUp && <span className="ml-2 font-normal text-muted">Finding address…</span>}
              </label>
              <input id="place-field" className={`input ${mobile ? 'bg-surface-2 cursor-not-allowed' : ''}`} maxLength={200} value={place} readOnly={mobile}
                     onChange={(e) => { setPlace(e.target.value); placeAuto.current = !e.target.value.trim(); }}
                     placeholder={mobile ? 'Waiting for GPS…' : 'e.g. Summer St near Anson St, Orange'} />
            </div>
            <button type="button" onClick={locateMe} disabled={locating} className="btn btn-secondary">
              <IconCrosshair size={16} /> {locating ? 'Getting exact location…' : mobile && lat != null ? 'Refresh GPS location' : 'Use my location'}
            </button>
          </div>
          {lat != null && lng != null && (
            <div className="mt-2 text-[12px] text-muted mono">
              Pin: {lat.toFixed(5)}, {lng.toFixed(5)}{accuracy != null && ` · ±${Math.round(accuracy)} m`}
              {mobile && accuracy != null && accuracy > MAX_GPS_ACCURACY_M && (
                <span className="text-rd-600 font-sans font-semibold"> · too weak, needs ±{MAX_GPS_ACCURACY_M} m or better</span>
              )}
            </div>
          )}
          {!online && (
            <div className="mt-5 p-3 rounded-lg border bg-am-50 border-am-500/25 text-[12.5px] text-am-700 flex gap-2">
              <IconAlert size={15} className="flex-none mt-0.5" />
              <span>
                <b>You're offline.</b> You can still make this report — it's saved on this phone and sent when you're back online.
                Reports already made nearby can't be checked right now; if this one was already reported, it will be refused when it's sent.
              </span>
            </div>
          )}
          {nearby.length > 0 && (
            <div className={`mt-5 p-4 rounded-lg border ${blocking ? 'bg-rd-50 border-rd-600/30' : 'bg-am-50 border-am-500/25'}`}>
              <div className={`text-[13.5px] font-bold flex items-center gap-2 ${blocking ? 'text-rd-700' : 'text-am-700'}`}>
                <IconAlert size={15} /> {blocking ? 'This was reported in the last hour' : 'Already reported nearby?'}
              </div>
              {blocking && (
                <p className="text-[12.5px] text-rd-700 mt-1">
                  A new report can't be sent within {NEARBY_M} m of an open report from the last hour. Back the existing report below instead.
                </p>
              )}
              <p className="text-[12.5px] text-am-700 mt-1 mb-3">
                {nearby.length === 1 ? 'There is an open report' : `There are ${nearby.length} open reports`} within {NEARBY_M} m of this spot.
                If it's the same problem, open it and tap <b>Back this report</b> — that raises its priority instead of creating a duplicate.
              </p>
              <div className="grid gap-2">
                {nearby.map(({ d, m }) => (
                  <Link key={d.id} to={`/defect/${d.id}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface border border-border hover:border-border-strong hover:no-underline">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-ink truncate">{d.title}</div>
                      <div className="text-[11.5px] text-muted truncate">{d.road} · {Math.round(m)} m away · {d.votes} backing</div>
                    </div>
                    <SeverityChip level={d.severity} />
                    <StatusBadge status={d.status} verified={!!d.verified_at} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Step 2 — details */}
      {step === 2 && (
        <section className="card p-6 space-y-6">
          <div>
            <h3 className="mb-3">What kind of defect?</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {TYPES.map(t => (
                <button type="button" key={t.id} onClick={() => setType(t.id)}
                        className={`p-3 rounded-btn border text-left text-[13px] font-semibold ${type === t.id ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-surface text-ink-2 hover:border-border-strong'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3">Severity</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {(['low', 'medium', 'high', 'critical'] as const).map(s => (
                <button type="button" key={s} onClick={() => setSev(s)}
                        className={`p-3 rounded-btn border text-left ${sev === s ? 'border-brand bg-brand-soft' : 'border-border bg-surface hover:border-border-strong'}`}>
                  <div className="flex items-center gap-2">
                    <i className="w-2.5 h-2.5 rounded-full block" style={{ background: SEVERITY[s].color }} />
                    <span className="text-[13px] font-bold">{SEVERITY[s].label}</span>
                  </div>
                  <div className="text-[11.5px] text-muted mt-1">SLA {SEVERITY[s].sla}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="label" htmlFor="r-title">Title <span className="text-rd-600">*</span></label>
            <input id="r-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX}
                   placeholder="Short summary — 'Deep pothole in eastbound lane'" aria-invalid={!!title && !titleOk} />
            <span className={`text-[11.5px] ${title && !titleOk ? 'text-rd-600' : 'text-muted'}`}>
              {title && !titleOk ? `Use real words, at least ${TITLE_MIN} characters.` : `${title.trim().length}/${TITLE_MAX}`}
            </span>
          </div>

          <div className="grid gap-1.5">
            <label className="label" htmlFor="r-desc">Description <span className="text-rd-600">*</span></label>
            <textarea id="r-desc" className="textarea" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={DESC_MAX}
                      placeholder="Anything the crew should know: depth, width, traffic risk, time of day it's worst…" aria-invalid={!!desc && !descOk} />
            <span className={`text-[11.5px] ${desc && !descOk ? 'text-rd-600' : 'text-muted'}`}>
              {desc && !descOk ? `A little more detail please — at least ${DESC_MIN} characters.` : `${desc.trim().length}/${DESC_MAX}`}
            </span>
          </div>
        </section>
      )}

      {/* Step 3 — photo & review */}
      {step === 3 && (
        <section className="card p-6 space-y-6">
          <div>
            <h3 className="mb-1">{mobile ? 'Take a photo' : 'Add a photo'} <span className="text-rd-600">*</span></h3>
            <p className="text-[13px] text-muted mb-3">
              {mobile
                ? `Use the camera at the defect. The date, time, GPS position and address are stamped on the photo. It must be taken within ${MAX_PHOTO_DISTANCE_M} m of the spot you reported.`
                : 'Take one with your camera, or upload a photo. Uploaded photos are marked as uploads for council to check.'}
            </p>
            <PhotoField large value={photo} onChange={setPhoto} validate={photoTooFar} label="Open camera"
                        place={lat != null && lng != null ? { lat, lng, label: place.trim() || undefined } : null} />
          </div>

          <div className="p-4 rounded-lg bg-surface-2 border border-border grid gap-2 text-[13.5px]">
            <div className="section-label mb-1">Review</div>
            <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-1.5">
              <div className="text-muted">Location</div><div className="font-semibold">{place || '—'}</div>
              <div className="text-muted">Type</div><div className="font-semibold">{type ? TYPES.find(t => t.id === type)?.label : '—'}</div>
              <div className="text-muted">Severity</div><div className="font-semibold">{sev ? SEVERITY[sev].label : '—'}</div>
              <div className="text-muted">Title</div><div className="font-semibold">{title || '—'}</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-am-50 border border-am-500/25">
            <span className="text-am-700 mt-0.5"><IconAlert size={16} /></span>
            <p className="text-[12.5px] text-am-700">
              Reports are published to the public map. Your name and address are never shown.
            </p>
          </div>
        </section>
      )}

      {/* Nav buttons */}
      <div className="flex justify-between mt-6">
        <button className="btn btn-secondary" onClick={() => step > 1 ? setStep(step - 1) : nav('/')}>
          <IconLeft size={16} /> Back
        </button>
        {step < 3 ? (
          <button className="btn btn-primary" onClick={next}>Next <IconRight size={16} /></button>
        ) : (
          <button className="btn btn-success" onClick={submit} disabled={busy || !photo} title={photo ? undefined : 'Add a photo first'}>
            <IconCheck size={16} /> {busy ? 'Submitting…' : online ? 'Submit report' : 'Save and send later'}
          </button>
        )}
      </div>
    </main>
  );
}
