/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Cloudflare Turnstile site key — turns on the "I'm not a robot" check (optional). */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** Web-push public key — turns on phone notifications (optional, see docs/02-SUPABASE.md). */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
