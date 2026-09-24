import { slaStatus } from '../lib/sla';
import { IconClock, IconAlert } from '../lib/icons';
import type { Defect } from '../lib/types';

/** "Due in 3 days" / "Overdue by 5 hr" for open defects; renders nothing once finished. */
export function SlaChip({ d, className = '' }: { d: Pick<Defect, 'reported_at' | 'severity' | 'status' | 'due_at'>; className?: string }) {
  const s = slaStatus(d);
  if (!s) return null;
  return (
    <span title={`Due ${s.due.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}`}
          className={`inline-flex items-center gap-1 text-[11.5px] font-semibold whitespace-nowrap ${s.overdue ? 'text-rd-600' : s.soon ? 'text-am-700' : 'text-muted'} ${className}`}>
      {s.overdue || s.soon ? <IconAlert size={12} /> : <IconClock size={12} />} {s.label}
    </span>
  );
}
