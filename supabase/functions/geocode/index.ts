// RoadFix — address lookup proxy (Supabase Edge Function, Deno).
//
// Sends address lookups to OpenStreetMap Nominatim from one server with a proper
// User-Agent, and caches answers in public.geocode_cache so repeat lookups are
// instant and we stay inside Nominatim's 1 request/second usage policy.
//
// Deploy:  supabase functions deploy geocode
// Call:    POST { mode: 'reverse', lat, lng }  or  { mode: 'search', q }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'RoadFix/1.0 (Orange City Council road defect reporting)';
const CACHE_DAYS = 30;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// Serialise upstream calls in this instance so we never burst past 1 req/s
let last = 0;
async function politeFetch(url: string) {
  const wait = last + 1100 - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  last = Date.now();
  return fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-AU,en' } });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: { mode?: string; lat?: number; lng?: number; q?: string };
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }

  let key: string, url: string;
  if (body.mode === 'reverse' && Number.isFinite(body.lat) && Number.isFinite(body.lng)) {
    // ~1 m precision is plenty and makes nearby taps share a cache entry
    const lat = body.lat!.toFixed(5), lng = body.lng!.toFixed(5);
    key = `r:${lat},${lng}`;
    url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`;
  } else if (body.mode === 'search' && typeof body.q === 'string' && body.q.trim().length >= 3 && body.q.length <= 200) {
    const q = body.q.trim().toLowerCase().replace(/\s+/g, ' ');
    key = `s:${q}`;
    const params = new URLSearchParams({
      format: 'jsonv2', addressdetails: '1', limit: '6', countrycodes: 'au',
      viewbox: '148.95,-33.18,149.25,-33.40', q,
    });
    url = `${NOMINATIM}/search?${params}`;
  } else {
    return json({ error: 'Send { mode: "reverse", lat, lng } or { mode: "search", q }' }, 400);
  }

  const since = new Date(Date.now() - CACHE_DAYS * 86400000).toISOString();
  const { data: hit } = await db.from('geocode_cache').select('result').eq('key', key).gte('created_at', since).maybeSingle();
  if (hit) return json(hit.result);

  const res = await politeFetch(url);
  if (!res.ok) return json({ error: `Lookup failed (${res.status})` }, 502);
  const result = await res.json();
  await db.from('geocode_cache').upsert({ key, result, created_at: new Date().toISOString() });
  return json(result);
});
