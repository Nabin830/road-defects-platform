import { useEffect, useMemo, useRef, useState } from 'react';
import { IconCamera, IconUpload, IconX } from '../lib/icons';
import { photoProblem } from '../lib/image';
import { isMobileDevice, prepareUpload, type PhotoEvidence, type PhotoPlace } from '../lib/evidence';
import { errorMessage } from '../lib/utils';
import { CameraCapture } from './CameraCapture';

interface Props {
  value: PhotoEvidence | null;
  onChange: (p: PhotoEvidence | null) => void;
  label?: string;
  /** Where the photo belongs: stamped on uploads, and used for "x m from RD-…" on camera photos. */
  place?: PhotoPlace | null;
  /** Extra check on a new photo; return a message to refuse it. */
  validate?: (p: PhotoEvidence) => string | null;
  large?: boolean;
}

/** Single photo with preview. Phones and tablets: live camera only (no gallery).
 *  Computers: live camera (webcam) or upload a file, which is stamped as an upload. */
export function PhotoField({ value, onChange, label = 'Add a photo', place, validate, large }: Props) {
  const mobile = useMemo(isMobileDevice, []);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!value) { setPreview(null); return; }
    const url = URL.createObjectURL(value.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  function accept(p: PhotoEvidence) {
    const problem = validate?.(p);
    if (problem) { setError(problem); return; }
    onChange(p);
  }

  async function upload(f: File | undefined) {
    if (input.current) input.current.value = '';
    setError('');
    if (!f) return;
    const problem = photoProblem(f);
    if (problem) return setError(problem);
    setBusy(true);
    try { accept(await prepareUpload(f, place ?? null)); }
    catch (e) { setError(errorMessage(e, "That photo couldn't be opened.")); }
    finally { setBusy(false); }
  }

  function clear() {
    setError('');
    onChange(null);
  }

  const h = large ? 'min-h-[160px]' : 'min-h-[80px]';
  return (
    <div className="grid gap-1.5">
      {value && preview ? (
        <div className="relative rounded-lg overflow-hidden border border-border">
          <img src={preview} alt="Selected photo" className={`w-full object-contain bg-black ${large ? 'max-h-[420px]' : 'max-h-[260px]'}`} />
          <button type="button" onClick={clear} aria-label="Remove photo"
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80">
            <IconX size={15} />
          </button>
        </div>
      ) : (
        <div className={`grid gap-2.5 ${mobile ? '' : 'sm:grid-cols-2'}`}>
          <button type="button" onClick={() => { setError(''); setCamera(true); }}
                  className={`${h} flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border-2 border-dashed border-border-strong bg-surface-2 text-[13.5px] font-semibold text-ink-2 hover:border-brand hover:bg-brand-soft`}>
            <IconCamera size={large ? 26 : 20} className="text-muted" />
            {mobile ? label : 'Take a photo'}
            <span className="text-[11.5px] font-normal text-muted">Time, GPS and address are stamped on it</span>
          </button>
          {!mobile && (
            <div role="button" tabIndex={0} onClick={() => input.current?.click()}
                 onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
                 onDragOver={(e) => e.preventDefault()}
                 onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files?.[0]); }}
                 className={`${h} flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border-2 border-dashed border-border-strong bg-surface-2 text-[13.5px] font-semibold text-ink-2 cursor-pointer text-center hover:border-brand hover:bg-brand-soft`}>
              <IconUpload size={large ? 26 : 20} className="text-muted" />
              {busy ? 'Preparing photo…' : 'Upload from computer'}
              <span className="text-[11.5px] font-normal text-muted">Drop or click · JPEG, PNG or WebP · marked as an upload</span>
              <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                     onChange={(e) => void upload(e.target.files?.[0])} />
            </div>
          )}
        </div>
      )}
      {error && <span className="err">{error}</span>}
      {camera && (
        <CameraCapture place={place} requireGps={mobile}
                       onClose={() => setCamera(false)}
                       onCapture={(p) => { setCamera(false); setError(''); accept(p); }} />
      )}
    </div>
  );
}
