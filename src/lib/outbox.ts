/** Offline outbox: reports made with no internet are kept on the phone (IndexedDB, photo included)
 *  and sent when the connection comes back.
 *
 *  Nothing here is trusted by the server. A saved report is sent through the normal API, signed in
 *  as its owner, and the database applies every usual check (rate limits, duplicates, council area,
 *  photo ownership) plus stricter offline rules — see check_photo_evidence in supabase/Database.sql. */
import { create } from 'zustand';
import { api } from './api';
import { supabase } from './supabase';
import { reverseGeocode } from './geocode';
import { errorMessage, isNetworkError, newDefectId } from './utils';
import type { PhotoMeta } from './evidence';
import type { CreateDefectInput } from './types';
import { useUI } from '../store/ui';

/** Same as the database's daily report limit — more could never be sent. */
export const OUTBOX_MAX = 10;

export interface OutboxItem {
  key: string;                       // local id, also names the uploaded photo file
  userId: string;
  defectId: string;                  // fixed when saved, so a resend can't create a second copy
  input: Omit<CreateDefectInput, 'photo_url' | 'photo'>;
  meta: PhotoMeta;
  photo: Blob;
  /** The road text is a placeholder ("Near -33.28, 149.10"); look the address up when sending. */
  needsAddress: boolean;
  photoUrl: string | null;           // set once the photo is uploaded
  savedAt: string;
  status: 'waiting' | 'failed';
  error: string | null;
}

/* ── IndexedDB ───────────────────────────────────────────────────── */
const DB_NAME = 'roadfix-outbox';
const STORE = 'reports';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'key' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open storage on this device.'));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error('Could not save on this device.'));
      tx.onabort = () => reject(tx.error ?? new Error('Could not save on this device — it may be out of space.'));
    });
  } finally { db.close(); }
}

const readAll = () => run<OutboxItem[]>('readonly', s => s.getAll() as IDBRequest<OutboxItem[]>);
const put = (item: OutboxItem) => run('readwrite', s => s.put(item));
const remove = (key: string) => run('readwrite', s => s.delete(key));

/* ── Store (what the UI shows) ───────────────────────────────────── */
interface OutboxState {
  items: OutboxItem[];
  sending: boolean;
  online: boolean;
  reload: () => Promise<void>;
}

export const useOutbox = create<OutboxState>((set) => ({
  items: [],
  sending: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  async reload() {
    const all = await readAll().catch(() => [] as OutboxItem[]);
    set({ items: all.sort((a, b) => a.savedAt.localeCompare(b.savedAt)) });
  },
}));

/** Keeps a report on this phone until it can be sent. */
export async function saveToOutbox(o: {
  userId: string; input: OutboxItem['input']; meta: PhotoMeta; photo: Blob; needsAddress: boolean; defectId?: string;
}): Promise<void> {
  const mine = (await readAll()).filter(i => i.userId === o.userId);
  if (mine.length >= OUTBOX_MAX) {
    throw new Error(`${OUTBOX_MAX} reports are already waiting on this phone. Send or delete some first.`);
  }
  await put({
    key: crypto.randomUUID(), userId: o.userId, defectId: o.defectId ?? newDefectId(),
    input: o.input, meta: o.meta, photo: o.photo, needsAddress: o.needsAddress,
    photoUrl: null, savedAt: new Date().toISOString(), status: 'waiting', error: null,
  });
  // Ask the browser not to clear this site's storage when the phone runs low on space
  void navigator.storage?.persist?.().catch(() => false);
  await useOutbox.getState().reload();
}

/** Removes a saved report, and its photo if that was already uploaded. */
export async function deleteFromOutbox(item: OutboxItem): Promise<void> {
  await remove(item.key);
  if (item.photoUrl) void api.deletePhoto(item.photoUrl);
  await useOutbox.getState().reload();
}

/** Puts a failed report back in the queue (e.g. after the reason it failed has passed). */
export async function retryOutboxItem(item: OutboxItem): Promise<void> {
  await put({ ...item, status: 'waiting', error: null });
  await useOutbox.getState().reload();
  void syncOutbox();
}

/* ── Sending ─────────────────────────────────────────────────────── */
/** Refusals that may pass on their own — keep the report waiting and try again later. */
const TRY_LATER = /wait a minute|reports today|JWT|not authenticated/i;

let running: Promise<void> | null = null;

/** Sends every waiting report that belongs to the signed-in user. Safe to call often. */
export function syncOutbox(): Promise<void> {
  if (running) return running;
  const go = (): Promise<void> => sendAll().catch(() => {}).finally(() => useOutbox.setState({ sending: false }));
  // One tab at a time, so two open tabs can't send the same report together
  const done: Promise<void> = navigator.locks
    ? navigator.locks.request('roadfix-outbox', { ifAvailable: true }, async lock => { if (lock) await go(); }).then(() => {})
    : go();
  running = done.finally(() => { running = null; });
  return running;
}

async function sendAll(): Promise<void> {
  if (!navigator.onLine) return;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;                       // signed out — the reports wait until their owner signs in again
  const waiting = (await readAll())
    .filter(i => i.userId === userId && i.status === 'waiting')
    .sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  if (!waiting.length) return;
  useOutbox.setState({ sending: true });

  for (const item of waiting) {
    const result = await sendOne(item);
    if (result === 'stop') break;
  }
  await useOutbox.getState().reload();
}

async function sendOne(item: OutboxItem): Promise<'sent' | 'failed' | 'stop'> {
  const { toast } = useUI.getState();
  try {
    let input = item.input;
    if (item.needsAddress) {
      const addr = await reverseGeocode(input.latitude, input.longitude).catch(() => null);
      if (addr) input = { ...input, road: addr };
    }
    let photoUrl = item.photoUrl;
    if (!photoUrl) {
      const file = new File([item.photo], 'photo.jpg', { type: item.photo.type || 'image/jpeg' });
      photoUrl = await api.uploadPhoto(file, item.userId, `offline-${item.key}`);
      await put({ ...item, photoUrl });      // a retry won't upload it again
    }
    const created = await api.createDefect({ ...input, photo_url: photoUrl, photo: item.meta }, item.userId,
      { id: item.defectId, offline: true });
    await remove(item.key);
    toast('success', `Saved report sent — ${created.id}`, 'Council will review it and assign a contractor.');
    return 'sent';
  } catch (err) {
    const message = errorMessage(err, 'Could not send this report.');
    // No connection, or a limit that passes with time: keep it waiting and stop for now
    if (isNetworkError(err) || TRY_LATER.test(message)) {
      await put({ ...item, error: isNetworkError(err) ? null : message }).catch(() => {});
      return 'stop';
    }
    // The database refused it (duplicate, too old, …) — keep it so the person sees why
    await put({ ...item, status: 'failed', error: message }).catch(() => {});
    toast('error', 'A saved report was not accepted', message);
    return 'failed';
  }
}

/** Starts watching the connection and sends saved reports whenever it's back. Call once. */
export function startOutbox(): void {
  const setOnline = () => useOutbox.setState({ online: navigator.onLine });
  window.addEventListener('online', () => { setOnline(); void syncOutbox(); });
  window.addEventListener('offline', setOnline);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void syncOutbox(); });
  // Rate limits allow one report a minute, so keep trying while anything is waiting
  setInterval(() => { if (useOutbox.getState().items.some(i => i.status === 'waiting')) void syncOutbox(); }, 65_000);
  void useOutbox.getState().reload().then(() => syncOutbox());
}
