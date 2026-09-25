import { useEffect, useRef, useState } from 'react';
import { IconCamera, IconX } from '../lib/icons';
import { photoProblem } from '../lib/image';

/** Single-photo picker with preview. Reports the chosen file (or null) to the parent. */
export function PhotoField({ onChange, label = 'Add a photo' }: { onChange: (f: File | null) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pick(f: File | undefined) {
    setError('');
    if (!f) return;
    const problem = photoProblem(f);
    if (problem) return setError(problem);
    setPreview(URL.createObjectURL(f));
    onChange(f);
  }

  function clear() {
    setPreview(null);
    onChange(null);
    if (input.current) input.current.value = '';
  }

  return (
    <div className="grid gap-1.5">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {preview ? (
        <div className="relative rounded-lg overflow-hidden border border-border">
          <img src={preview} alt="Selected photo" className="w-full max-h-[200px] object-cover" />
          <button type="button" onClick={clear} aria-label="Remove photo"
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80">
            <IconX size={14} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()}
                className="flex items-center justify-center gap-2 h-20 rounded-lg border-2 border-dashed border-border-strong bg-surface-2 text-[13px] font-semibold text-ink-2 hover:border-brand">
          <IconCamera size={18} /> {label}
        </button>
      )}
      {error && <span className="err">{error}</span>}
    </div>
  );
}
