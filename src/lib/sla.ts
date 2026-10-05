import type { Defect, Severity } from './types';

/** Calendar days (weekends included) council commits to per severity — the latest a fix can be before it's overdue. */
export const DEFAULT_FIX_DAYS: Record<Severity, number> = { critical: 1, high: 5, medium: 7, low: 10 };

export function slaDueDate(reportedAt: string, severity: Severity): Date {
  return new Date(new Date(reportedAt).getTime() + DEFAULT_FIX_DAYS[severity] * 86400000);
}

type DueFields = Pick<Defect, 'reported_at' | 'severity'> & { due_at?: string | null };

/** The fix-by date: council's own date if they set one on assignment, otherwise the severity default. */
export function dueDate(d: DueFields): Date {
  return d.due_at ? new Date(d.due_at) : slaDueDate(d.reported_at, d.severity);
}

export interface SlaStatus { due: Date; overdue: boolean; soon: boolean; label: string; }

const SOON_MS = 24 * 3600 * 1000;

/** Deadline status for open work; null once the job is finished or rejected. */
export function slaStatus(d: DueFields & Pick<Defect, 'status'>, now = Date.now()): SlaStatus | null {
  if (d.status === 'completed' || d.status === 'rejected') return null;
  const due = dueDate(d);
  const ms = due.getTime() - now;
  const hours = Math.abs(ms) / 3600000;
  const span = hours < 48 ? `${Math.max(1, Math.round(hours))} hr` : `${Math.round(hours / 24)} days`;
  return ms < 0
    ? { due, overdue: true, soon: false, label: `Overdue by ${span}` }
    : { due, overdue: false, soon: ms <= SOON_MS, label: `Due in ${span}` };
}
