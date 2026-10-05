import { useEffect, useRef } from 'react';

/** Cloudflare Turnstile — the "I'm not a robot" check on sign-up and sign-in, so one person
 *  can't script hundreds of fake accounts. Supabase checks the token on its side
 *  (Authentication → Attack Protection → CAPTCHA), so it can't be skipped by calling the API.
 *  Turned on by setting VITE_TURNSTILE_SITE_KEY; without it nothing is shown. */
export const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global { interface Window { turnstile?: TurnstileApi } }

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error('The robot check could not load. Check your connection.')); };
    document.head.appendChild(s);
  });
  return loading;
}

/** Calls onToken with a fresh token, or null when it expires. Change `resetKey` to get a new one
 *  (each token works once, so reset after every sign-in attempt). */
export function Turnstile({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_KEY) return;
    let gone = false;
    loadScript().then(() => {
      if (gone || !box.current || !window.turnstile) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_KEY,
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
        callback: (t: string) => cb.current(t),
        'expired-callback': () => cb.current(null),
        'error-callback': () => cb.current(null),
      });
    }).catch(() => cb.current(null));
    return () => {
      gone = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey && widget.current) { cb.current(null); window.turnstile?.reset(widget.current); }
  }, [resetKey]);

  if (!TURNSTILE_KEY) return null;
  return <div ref={box} className="min-h-[65px]" />;
}
