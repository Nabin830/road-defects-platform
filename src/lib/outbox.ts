/** Offline outbox: reports made with no internet — and contractors' job steps (accept, start,
 *  progress photo, completion) — are kept on the phone (IndexedDB, photo included) and sent when
 *  the connection comes back.
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

interface ItemBase {
  key: string;                       // local id, also names the uploaded photo file
  userId: string;
  defectId: string;                  // for reports: fixed when saved, so a resend can't create a second copy
  photoUrl: string | null;           // set once the photo is uploaded
  savedAt: string;
  status: 'waiting' | 'failed';
  error: string | null;
}

/** A resident's report made offline. (Saved before job steps existed → no `kind`.) */
export interface ReportItem extends ItemBase {
  kind?: 'report';
  input: Omit<CreateDefectInput, 'photo_url' | 'photo'>;
  meta: PhotoMeta;
  photo: Blob;
  /** The road text is a placeholder ("Near -33.28, 149.10"); look the address up when sending. */
  needsAddress: boolean;
}

export type JobStep = 'accept' | 'start' | 'progress' | 'complete';
export const JOB_STEP_LABEL: Record<JobStep, string> = {
  accept: 'Accept job', start: 'Mark in progress', progress: 'Progress update', complete: 'Repair complete',
};

/** A contractor's step on a job, made offline. Sent in order; a step that's refused holds back the later ones. */
export interface JobItem extends ItemBase {
  kind: 'job';
  step: JobStep;
  title: string;                     // the job's title, for the list
  note: string;
  progress: number | null;
  meta: PhotoMeta | null;
  photo: Blob | null;
}

export type OutboxItem = ReportItem | JobItem;
export const isJob = (i: OutboxItem): i is JobItem => i.kind === 'job';

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
  userId: string; input: ReportItem['input']; meta: PhotoMeta; photo: Blob; needsAddress: boolean; defectId?: string;
}): Promise<void> {
  const mine = (await readAll()).filter(i => i.userId === o.userId && !isJob(i));
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

/** Keeps a contractor's job step on this phone until it can be sent. */
export async function saveJobStep(o: {
  userId: string; defectId: string; title: string; step: JobStep; note: string; progress: number | null;
  photo: Blob | null; meta: PhotoMeta | null;
}): Promise<void> {
  if ((await readAll()).filter(i => i.userId === o.userId && isJob(i)).length >= 30) {
    throw new Error('30 job updates are already waiting on this phone. Get back online to send them first.');
  }
  await put({ ...o, kind: 'job', key: crypto.randomUUID(), photoUrl: null, savedAt: new Date().toISOString(), status: 'waiting', error: null });
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
const TRY_LATER = /wait a minute|reports today|updates on this job today|JWT|not authenticated/i;

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

  // A job step that was refused holds back that job's later steps (they'd make no sense without it)
  const blocked = new Set((await readAll()).filter(i => isJob(i) && i.status === 'failed').map(i => i.defectId));
  for (const item of waiting) {
    if (isJob(item) && blocked.has(item.defectId)) {
      await put({ ...item, status: 'failed', error: 'An earlier step for this job was not accepted.' });
      continue;
    }
    const result = isJob(item) ? await sendJobStep(item) : await sendOne(item);
    if (result === 'failed' && isJob(item)) blocked.add(item.defectId);
    if (result === 'stop') break;
  }
  await useOutbox.getState().reload();
}

/** Uploads a saved photo once (a fixed name, so a retry reuses it) and remembers its link. */
async function uploadSaved(item: OutboxItem, photo: Blob): Promise<string> {
  if (item.photoUrl) return item.photoUrl;
  const file = new File([photo], 'photo.jpg', { type: photo.type || 'image/jpeg' });
  const url = await api.uploadPhoto(file, item.userId, `offline-${item.key}`);
  await put({ ...item, photoUrl: url });
  item.photoUrl = url;
  return url;
}

async function sendJobStep(item: JobItem): Promise<'sent' | 'failed' | 'stop'> {
  const { toast } = useUI.getState();
  try {
    const id = item.defectId;
    if (item.step === 'accept') {
      await api.acceptAssignment(id, item.userId);
    } else if (item.step === 'start') {
      const d = await api.getDefect(id);
      await api.updateDefect(id, { status: 'progress', accepted_at: d.accepted_at ?? new Date().toISOString() });
      await api.addUpdate(id, { action: 'Work started', note: item.note || 'Crew on site.', progress: item.progress }, item.userId, 'contractor');
    } else {
      if (!item.photo || !item.meta) throw new Error('This step needs a photo.');
      const url = await uploadSaved(item, item.photo);
      if (item.step === 'progress') {
        await api.addUpdate(id, { action: 'Progress update', note: item.note, progress: item.progress, photo_url: url, photo: item.meta, offline: true }, item.userId, 'contractor');
      } else {
        await api.completeJob(id, item.note, url, item.meta, item.userId, true);
      }
    }
    await remove(item.key);
    toast('success', `Saved job update sent — ${id}`, JOB_STEP_LABEL[item.step]);
    return 'sent';
  } catch (err) {
    return keepOrFail(item, err, 'A saved job update was not accepted');
  }
}

/** No connection, or a limit that passes with time: keep it waiting and stop for now.
 *  Otherwise the database refused it (duplicate, too old, …) — keep it so the person sees why. */
async function keepOrFail(item: OutboxItem, err: unknown, title: string): Promise<'failed' | 'stop'> {
  const message = errorMessage(err, 'Could not send this.');
  if (isNetworkError(err) || TRY_LATER.test(message)) {
    await put({ ...item, error: isNetworkError(err) ? null : message }).catch(() => {});
    return 'stop';
  }
  await put({ ...item, status: 'failed', error: message }).catch(() => {});
  useUI.getState().toast('error', title, message);
  return 'failed';
}

async function sendOne(item: ReportItem): Promise<'sent' | 'failed' | 'stop'> {
  const { toast } = useUI.getState();
  try {
    let input = item.input;
    if (item.needsAddress) {
      const addr = await reverseGeocode(input.latitude, input.longitude).catch(() => null);
      if (addr) input = { ...input, road: addr };
    }
    const photoUrl = await uploadSaved(item, item.photo);
    const created = await api.createDefect({ ...input, photo_url: photoUrl, photo: item.meta }, item.userId,
      { id: item.defectId, offline: true });
    await remove(item.key);
    toast('success', `Saved report sent — ${created.id}`, 'Council will review it and assign a contractor.');
    return 'sent';
  } catch (err) {
    return keepOrFail(item, err, 'A saved report was not accepted');
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
