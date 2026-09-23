export function relativeTime(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
  const d = Math.floor(s / 86400);
  if (d === 1) return 'Yesterday';
  if (d < 7) return d + ' days ago';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function daysAgo(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
}

export function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function initialsOf(name: string): string {
  return (name || 'U').split(/\s+/).map(s => s[0] || '').slice(0, 2).join('').toUpperCase();
}

export function newDefectId(): string {
  // Timestamp (base36, seconds precision) + short random suffix — collision-safe
  // for a live multi-user app, unlike a 3-digit random number.
  const t = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `RD-${t}${r}`;
}
