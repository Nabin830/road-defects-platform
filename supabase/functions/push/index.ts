// RoadFix — phone notifications sender (Supabase Edge Function, Deno).
//
// The app calls this after anything that creates notifications. It takes the notifications not
// sent yet (each one only once, via claim_push_batch) and sends them to each person's phones.
// Callers can't choose what is sent or to whom — it only ever delivers real, unsent notifications.
//
// Setup (once):
//   npx web-push generate-vapid-keys
//   npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
//   npx supabase functions deploy push
// and put the same public key in VITE_VAPID_PUBLIC_KEY (Vercel + .env.local).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:council@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

interface Pending { id: string; user_id: string; defect_id: string | null; defect_title: string | null; title: string; body: string | null }
interface Device { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // Only signed-in RoadFix users can nudge the sender (stops anonymous hammering)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: who } = await db.auth.getUser(token);
  if (!who?.user) return json({ error: 'Sign in required' }, 401);

  const { data: pending, error } = await db.rpc('claim_push_batch');
  if (error) return json({ error: error.message }, 500);
  const items = (pending ?? []) as Pending[];
  if (!items.length) return json({ sent: 0 });

  const users = [...new Set(items.map(n => n.user_id))];
  const { data: devices } = await db.from('push_subscriptions').select('*').in('user_id', users);
  const byUser = new Map<string, Device[]>();
  for (const d of (devices ?? []) as Device[]) byUser.set(d.user_id, [...(byUser.get(d.user_id) ?? []), d]);

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(items.map(async (n) => {
    const payload = JSON.stringify({
      title: n.defect_title ? `${n.title} — ${n.defect_title}` : n.title,
      body: (n.body ?? '').slice(0, 180),
      url: n.defect_id ? `/defect/${encodeURIComponent(n.defect_id)}` : '/',
      tag: n.defect_id ?? n.id,
    });
    for (const d of byUser.get(n.user_id) ?? []) {
      try {
        await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, { TTL: 86400 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(d.id);   // phone turned notifications off / app removed
      }
    }
  }));
  if (gone.length) await db.from('push_subscriptions').delete().in('id', gone);
  return json({ sent, removed: gone.length });
});
