import type { PhotoInfo } from '../lib/types';
import { PHOTO_FLAG_LABEL, stampTime } from '../lib/evidence';
import { IconAlert, IconShield } from '../lib/icons';

/** Council-only summary of how a photo was taken and what the database flagged about it. */
export function PhotoChecks({ info, compact }: { info: PhotoInfo; compact?: boolean }) {
  if (!info.photo_source) return null;   // photos from before the checks existed
  const flags = info.photo_flags ?? [];
  const how = info.photo_source === 'camera' ? 'Live camera' : 'Uploaded from a computer';
  const facts = [
    how,
    info.photo_taken_at && `taken ${stampTime(new Date(info.photo_taken_at))}`,
    info.photo_accuracy != null && `GPS ±${Math.round(info.photo_accuracy)} m`,
  ].filter(Boolean).join(' · ');

  return (
    <div className={`rounded-lg border text-[12.5px] ${compact ? 'p-2.5 mt-2' : 'p-3'} ${flags.length ? 'bg-am-50 border-am-500/30 text-am-700' : 'bg-surface-2 border-border text-ink-2'}`}>
      <div className="font-bold flex items-center gap-1.5">
        {flags.length ? <IconAlert size={14} /> : <IconShield size={14} className="text-em-600" />}
        {flags.length ? `Photo check: ${flags.length} warning${flags.length === 1 ? '' : 's'}` : 'Photo check: no problems found'}
      </div>
      <div className="mt-0.5 opacity-90">{facts}</div>
      {flags.length > 0 && (
        <ul className="mt-1.5 list-disc pl-5 grid gap-0.5">
          {flags.map(f => <li key={f}>{PHOTO_FLAG_LABEL[f] ?? f}</li>)}
        </ul>
      )}
    </div>
  );
}
