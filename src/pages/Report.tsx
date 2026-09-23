import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { DefectMap } from '../components/DefectMap';
import { TYPES, SEVERITY } from '../lib/constants';
import { IconCrosshair, IconLeft, IconRight, IconUpload, IconCheck, IconAlert, IconX } from '../lib/icons';
import type { DefectType, Severity } from '../lib/types';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export function ReportPage() {
  const nav = useNavigate();
  const { userId } = useAuth();
  const { toast } = useUI();

  const [step, setStep] = useState(1);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [place, setPlace] = useState('');
  const [locating, setLocating] = useState(false);
  const [type, setType] = useState<DefectType | ''>('');
  const [sev, setSev] = useState<Severity | ''>('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const steps = ['Location', 'Details', 'Photo & submit'];

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      return toast('error', 'Location unavailable', 'Your browser does not support geolocation.');
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setLat(latitude); setLng(longitude);
        setPlace(`Near ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        toast('success', 'Location found', `Accurate to about ${Math.round(accuracy)} metres.`);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        toast('error', 'Could not get location', err.message || 'Check location permissions and try again.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function pickPhoto(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('warning', 'Not an image', 'Please choose a JPEG or PNG file.');
    if (file.size > MAX_PHOTO_BYTES) return toast('warning', 'File too large', 'Photos must be under 8MB.');
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function next() {
    if (step === 1 && (lat == null || lng == null)) return toast('warning', 'Pick a location', 'Tap on the map or use "Use my location".');
    if (step === 2 && (!type || !sev || !title)) return toast('warning', 'Missing details', 'Choose a type, severity, and title.');
    setStep(Math.min(3, step + 1));
  }

  async function submit() {
    if (lat == null || lng == null || !type || !sev || !title) {
      return toast('warning', 'Fill in required fields', 'Something is missing.');
    }
    if (!userId) return toast('warning', 'Sign in required', 'Create an account or sign in to submit a report.');
    setBusy(true);
    try {
      let photo_url: string | null = null;
      if (photoFile) {
        try {
          photo_url = await api.uploadPhoto(photoFile, userId);
        } catch (err: any) {
          toast('warning', 'Photo upload failed', err.message || 'Submitting without the photo.');
        }
      }
      const created = await api.createDefect({
        title, description: desc, defect_type: type as DefectType, severity: sev as Severity,
        road: place || 'Orange NSW', latitude: lat, longitude: lng, photo_url,
      }, userId);
      toast('success', `Report submitted — ${created.id}`, 'Council will triage within one business day.');
      nav('/my-reports');
    } catch (err: any) {
      toast('error', 'Could not submit report', err.message || 'Please try again.');
    } finally { setBusy(false); }
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
              <div className={`text-[13px] font-semibold whitespace-nowrap ${on || done ? 'text-ink' : 'text-muted'}`}>{s}</div>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-3 ${done ? 'bg-em-600' : 'bg-border'}`} />}
            </div>
          );
        })}
      </div>

      {/* Step 1 — location */}
      {step === 1 && (
        <section className="card p-6">
          <h3 className="mb-2">Where is it?</h3>
          <p className="text-[13.5px] text-muted mb-5">Tap the map to drop a pin, or use your device location.</p>
          <div className="mb-4">
            <DefectMap defects={[]} height={400} onPick={(la, ln) => {
              setLat(la); setLng(ln);
              setPlace(`Near ${la.toFixed(4)}, ${ln.toFixed(4)}`);
            }} pickedLat={lat} pickedLng={lng} legend={false} />
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[220px] grid gap-1.5">
              <label className="label" htmlFor="place-field">Nearest road or landmark</label>
              <input id="place-field" className="input" value={place} onChange={(e) => setPlace(e.target.value)}
                     placeholder="e.g. Summer St near Anson St, Orange" />
            </div>
            <button type="button" onClick={useMyLocation} disabled={locating} className="btn btn-secondary">
              <IconCrosshair size={16} /> {locating ? 'Locating…' : 'Use my location'}
            </button>
          </div>
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
            <label className="label" htmlFor="r-title">Title</label>
            <input id="r-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)}
                   placeholder="Short summary — 'Deep pothole in eastbound lane'" />
          </div>

          <div className="grid gap-1.5">
            <label className="label" htmlFor="r-desc">Description</label>
            <textarea id="r-desc" className="textarea" value={desc} onChange={(e) => setDesc(e.target.value)}
                      placeholder="Anything the crew should know: depth, width, traffic risk, time of day it's worst…" />
          </div>
        </section>
      )}

      {/* Step 3 — photo & review */}
      {step === 3 && (
        <section className="card p-6 space-y-6">
          <div>
            <h3 className="mb-2">Add a photo <span className="text-muted text-sm font-normal">(recommended)</span></h3>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                   onChange={(e) => pickPhoto(e.target.files?.[0])} />
            {photoPreview ? (
              <div className="relative rounded-card overflow-hidden border border-border">
                <img src={photoPreview} alt="Defect photo preview" className="w-full max-h-[320px] object-cover" />
                <button type="button" onClick={clearPhoto}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
                        aria-label="Remove photo">
                  <IconX size={16} />
                </button>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()}
                   onDragOver={(e) => e.preventDefault()}
                   onDrop={(e) => { e.preventDefault(); pickPhoto(e.dataTransfer.files?.[0]); }}
                   className="p-8 rounded-card border-2 border-dashed cursor-pointer text-center grid place-items-center gap-2 border-border-strong bg-surface-2 hover:border-sky-500 hover:bg-brand-soft">
                <IconUpload size={28} className="text-muted" />
                <div className="text-[14px] font-semibold text-ink-2">Drop a photo here or click to upload</div>
                <div className="text-[12px] text-muted">JPEG, PNG, or WebP, up to 8MB</div>
              </div>
            )}
          </div>

          <div className="p-4 rounded-lg bg-surface-2 border border-border grid gap-2 text-[13.5px]">
            <div className="section-label mb-1">Review</div>
            <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-1.5">
              <div className="text-muted">Location</div><div className="font-semibold">{place || '—'}</div>
              <div className="text-muted">Type</div><div className="font-semibold">{type ? TYPES.find(t => t.id === type)?.label : '—'}</div>
              <div className="text-muted">Severity</div><div className="font-semibold">{sev ? SEVERITY[sev as Severity].label : '—'}</div>
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
          <button className="btn btn-success" onClick={submit} disabled={busy}>
            <IconCheck size={16} /> {busy ? 'Submitting…' : 'Submit report'}
          </button>
        )}
      </div>
    </main>
  );
}
