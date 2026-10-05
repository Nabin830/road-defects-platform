/** Phone notifications (web push). The phone gives us an address to send to; it's saved for the
 *  signed-in user and the "push" Edge Function sends each new notification there. */
import { api } from './api';
import { HAS_SUPABASE } from './supabase';

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/** Why notifications can't be turned on here, or null if they can. */
export function pushUnavailableReason(): string | null {
  if (!HAS_SUPABASE || !VAPID_KEY) return 'Phone notifications are not set up on this site yet.';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const installed = matchMedia('(display-mode: standalone)').matches;
    return iOS && !installed
      ? 'On iPhone, first add RoadFix to your home screen (Share → Add to Home Screen), then open it from there.'
      : "This browser can't show notifications.";
  }
  return null;
}

/** The site's service worker, or null if none is registered (e.g. the dev server).
 *  Not `serviceWorker.ready` — that never resolves without one, which froze sign-out. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function isPushOn(): Promise<boolean> {
  if (pushUnavailableReason()) return false;
  return Notification.permission === 'granted' && !!(await currentSubscription().catch(() => null));
}

export async function enablePush(): Promise<void> {
  const why = pushUnavailableReason();
  if (why) throw new Error(why);
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications are blocked. Allow them for this site in your phone or browser settings.');
  }
  const reg = await registration();
  if (!reg) throw new Error('Notifications work on the live site (or the installed app). Open RoadFix there and try again.');
  const sub = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_KEY) });
  await api.savePushSubscription(sub.toJSON());
}

/** Turns them off on this device — also run at sign-out, so the next person on this phone doesn't get them. */
export async function disablePush(): Promise<void> {
  if (pushUnavailableReason()) return;
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return;
  await api.removePushSubscription(sub.endpoint).catch(() => {});
  await sub.unsubscribe().catch(() => false);
}

function base64UrlToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
