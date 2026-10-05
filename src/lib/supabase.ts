import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const HAS_SUPABASE = Boolean(
  url && key &&
  !url.includes('YOUR_PROJECT_ID') &&
  !key.includes('YOUR_ANON')
);

// The project has no generated database types, so the client is untyped; the data layer (api.ts) types each result
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const supabase: SupabaseClient = HAS_SUPABASE
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })
  : (createClient('https://placeholder.supabase.co', 'placeholder', { auth: { persistSession: false } }));

if (!HAS_SUPABASE) {
  console.info('[Supabase] Not configured — running in demo mode. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
}
