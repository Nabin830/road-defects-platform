/** Last-loaded copies of pages a contractor needs in the field (their jobs, each job's details),
 *  so they still show with no signal. Only ever shown as "saved copy" — never sent anywhere. */
const PREFIX = 'roadfix-cache:';
const MAX_DEFECTS = 60;

interface Saved<T> { at: string; data: T }

export function saveCopy<T>(name: string, data: T): void {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify({ at: new Date().toISOString(), data } satisfies Saved<T>));
    if (name.startsWith('defect:')) trimDefects();
  } catch { /* storage full or blocked — just no offline copy */ }
}

export function readCopy<T>(name: string): Saved<T> | null {
  try { return JSON.parse(localStorage.getItem(PREFIX + name) || 'null') as Saved<T> | null; }
  catch { return null; }
}

/** Forget everything (sign-out: the next person on this phone shouldn't see these jobs). */
export function clearCopies(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch { /* nothing to clear */ }
}

function trimDefects() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX + 'defect:'));
  if (keys.length <= MAX_DEFECTS) return;
  const byAge = keys.map(k => ({ k, at: (JSON.parse(localStorage.getItem(k) || '{}') as { at?: string }).at ?? '' }))
    .sort((a, b) => a.at.localeCompare(b.at));
  for (const { k } of byAge.slice(0, keys.length - MAX_DEFECTS)) localStorage.removeItem(k);
}
