/** Reverse geocoding via OpenStreetMap Nominatim (free, no key; keep to ~1 request/second). */

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
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { signal, headers: { 'Accept-Language': 'en-AU,en' } });
  if (!res.ok) return null;
  const data: { address?: NominatimAddress; display_name?: string } = await res.json();
  const a = data.address;
  if (!a) return data.display_name ?? null;

  const road = a.road || a.pedestrian || a.footway || a.path;
  const street = road ? [a.house_number, road].filter(Boolean).join(' ') : null;
  const locality = a.suburb || a.neighbourhood || a.town || a.city || a.village || a.hamlet || a.municipality;
  const parts = [street, locality].filter(Boolean);
  return parts.length ? parts.join(', ') : data.display_name ?? null;
}
