/** Address lookups via OpenStreetMap Nominatim. When Supabase is connected they go through the
 *  "geocode" Edge Function (shared cache + polite rate limit); if that isn't deployed we call Nominatim directly. */
import { supabase, HAS_SUPABASE } from './supabase';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
let proxyAvailable = HAS_SUPABASE;   // flips off after the first failure so we don't keep retrying a missing function

type LookupBody = { mode: 'reverse'; lat: number; lng: number } | { mode: 'search'; q: string };

async function lookup<T>(body: LookupBody, directUrl: string, signal?: AbortSignal): Promise<T | null> {
  if (proxyAvailable) {
    try {
      const res = await supabase.functions.invoke<T & { error?: string }>('geocode', { body });
      const data = res.data;
      const error: unknown = res.error;   // the library types this as `any`
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!error && data && !(data as { error?: string }).error) return data;
      if (error) proxyAvailable = false;
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      proxyAvailable = false;
    }
  }
  const res = await fetch(directUrl, { signal, headers: { 'Accept-Language': 'en-AU,en' } });
  return res.ok ? (res.json() as Promise<T>) : null;
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  path?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  postcode?: string;
}

/** Turns a lat/lng into a short street address like "12 Summer Street, Orange". Returns null if nothing useful was found. */
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`;
  const data = await lookup<{ address?: NominatimAddress; display_name?: string }>({ mode: 'reverse', lat, lng }, url, signal);
  if (!data) return null;
  const a = data.address;
  if (!a) return data.display_name ?? null;

  return shortLabel(a, false) ?? data.display_name ?? null;
}

export interface PlaceResult { label: string; lat: number; lng: number; }

/** Address search, biased to the Orange NSW area (results elsewhere in Australia are still allowed). */
export async function searchAddress(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({
    format: 'jsonv2', addressdetails: '1', limit: '6', countrycodes: 'au',
    viewbox: '148.95,-33.18,149.25,-33.40', q,
  });
  const rows = await lookup<Array<{ lat: string; lon: string; display_name: string; address?: NominatimAddress }>>(
    { mode: 'search', q }, `${NOMINATIM}/search?${params}`, signal);
  if (!Array.isArray(rows)) return [];
  return rows.map(r => ({ label: shortLabel(r.address) || r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }));
}

function shortLabel(a?: NominatimAddress, withPostcode = true): string | null {
  if (!a) return null;
  const road = a.road || a.pedestrian || a.footway || a.path;
  const street = road ? [a.house_number, road].filter(Boolean).join(' ') : null;
  const locality = a.suburb || a.neighbourhood || a.town || a.city || a.village || a.hamlet || a.municipality;
  const parts = [street, locality, withPostcode ? a.postcode : null].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}
