/** Which reports council should look at first. A simple, explainable score — every point has a reason
 *  shown next to it, so council can see why something is near the top. */
import { slaStatus } from './sla';
import type { Defect, Severity } from './types';

const SEVERITY_POINTS: Record<Severity, number> = { critical: 40, high: 25, medium: 12, low: 5 };

export interface Priority { score: number; reasons: string[] }

export function priorityOf(d: Defect): Priority {
  const reasons: string[] = [];
  let score = SEVERITY_POINTS[d.severity];

  const backing = Math.min(d.votes * 4, 24);
  if (backing) { score += backing; reasons.push(`${d.votes} backing`); }

  const waitingDays = (Date.now() - new Date(d.reported_at).getTime()) / 86400000;
  const waiting = Math.min(Math.floor(waitingDays) * 2, 20);
  if (waiting) { score += waiting; reasons.push(`waiting ${Math.floor(waitingDays)} d`); }

  const sla = slaStatus(d);
  if (sla?.overdue) { score += 25; reasons.push('overdue'); }
  else if (sla?.soon) { score += 10; reasons.push('due within 24 h'); }

  if (d.reopen_requested_at && d.verified_at && new Date(d.reopen_requested_at) > new Date(d.verified_at)) {
    score += 20; reasons.push('resident says not fixed');
  }
  return { score, reasons };
}

/** Highest priority first; ties go to the older report. */
export function byPriority(a: Defect, b: Defect): number {
  return priorityOf(b).score - priorityOf(a).score || +new Date(a.reported_at) - +new Date(b.reported_at);
}
