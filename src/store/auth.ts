import { create } from 'zustand';
import { HAS_SUPABASE, supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { clearCopies } from '../lib/cache';
import type { Profile, Role } from '../lib/types';

interface AuthState {
  ready: boolean;
  userId: string | null;
  profile: Profile | null;
  role: Role;                    // best-effort — 'citizen' when signed out
  demoRole: Role;                // used when Supabase not configured
  init: () => Promise<void>;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  /** Creates the account and signs it in. No emails are sent (Supabase "Confirm email" must be OFF). */
  signUp: (email: string, password: string, name: string, role: Role, captchaToken?: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-read the signed-in user's profile (role, contractor link) from the database. */
  /** `force` skips the once-a-minute limit (e.g. right after saving the profile). */
  refreshProfile: (force?: boolean) => Promise<void>;
  setDemoRole: (r: Role) => void;
  setDemoAuthed: (b: boolean) => void;
  authed: boolean;
  /** Signed in from the copy on this device because there's no internet to renew the sign-in. */
  offlineSession: boolean;
}

/** Load a profile, retrying once — a single failed request mustn't demote council to a resident view. */
async function loadProfile(uid: string): Promise<Profile | null> {
  const first = await api.getProfile(uid);
  if (first) return first;
  await new Promise(r => setTimeout(r, 800));
  return api.getProfile(uid);
}

let lastProfileCheck = 0;

/* The last signed-in profile, kept on this device so the app still knows who you are with no
 * internet (the sign-in itself can't be renewed offline). It only affects what this screen shows:
 * nothing reaches the database until Supabase accepts the real sign-in again. */
const LAST_USER = 'roadfix-last-user';
function rememberProfile(profile: Profile | null) {
  try {
    if (profile) localStorage.setItem(LAST_USER, JSON.stringify(profile));
    else localStorage.removeItem(LAST_USER);
  } catch { /* storage blocked — offline sign-in just won't be available */ }
}
function rememberedProfile(uid?: string): Profile | null {
  try {
    const p = JSON.parse(localStorage.getItem(LAST_USER) || 'null') as Profile | null;
    return p && (!uid || p.id === uid) ? p : null;
  } catch { return null; }
}
const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export const useAuth = create<AuthState>((set, get) => ({
  ready: false,
  userId: null,
  profile: null,
  role: 'citizen',
  demoRole: 'citizen',
  authed: false,
  offlineSession: false,

  async init() {
    if (!HAS_SUPABASE) {
      set({ ready: true });
      return;
    }
    supabase.auth.onAuthStateChange((evt, session) => {
      if (!session) {
        // No session only because it couldn't be renewed offline — stay signed in on this device
        if (evt !== 'SIGNED_OUT' && offline() && get().offlineSession) return;
        if (evt === 'SIGNED_OUT') rememberProfile(null);
        set({ userId: null, profile: null, role: get().demoRole, authed: false, offlineSession: false });
        return;
      }
      // Supabase calls made directly inside this callback can deadlock the client,
      // so load the profile on the next tick.
      const uid = session.user.id;
      setTimeout(async () => {
        const loaded = await loadProfile(uid);
        // Token refreshes re-run this; if the profile can't be read, keep what we already know
        const prev = get();
        const profile = loaded ?? (prev.userId === uid ? prev.profile : null) ?? rememberedProfile(uid);
        if (loaded) rememberProfile(loaded);
        set({ userId: uid, profile, role: profile?.role || 'citizen', authed: true, offlineSession: false });
      }, 0);
    });

    // Back online after starting offline: check the sign-in for real
    window.addEventListener('online', () => {
      if (!get().offlineSession) return;
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) return;   // renewed — onAuthStateChange fills in the rest
        set({ userId: null, profile: null, role: get().demoRole, authed: false, offlineSession: false });
      });
    });

    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const uid = data.session.user.id;
        const loaded = await loadProfile(uid);
        if (loaded) rememberProfile(loaded);
        const profile = loaded ?? rememberedProfile(uid);
        set({ userId: uid, profile, role: profile?.role || 'citizen', authed: true });
      } else if (offline()) {
        const profile = rememberedProfile();
        if (profile) set({ userId: profile.id, profile, role: profile.role, authed: true, offlineSession: true });
      }
    } catch {
      const profile = offline() ? rememberedProfile() : null;
      if (profile) set({ userId: profile.id, profile, role: profile.role, authed: true, offlineSession: true });
    } finally {
      // Even if the session check fails (e.g. offline), stop showing "Loading…" — the user can sign in again
      set({ ready: true });
    }
  },

  async signIn(email, password, captchaToken) {
    await api.signIn({ email, password, captchaToken });
    // onAuthStateChange will fire, but wait a tick and force refresh just in case
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const profile = await api.getProfile(data.session.user.id);
      rememberProfile(profile);
      set({ userId: data.session.user.id, profile, role: profile?.role || 'citizen', authed: true, offlineSession: false });
    }
  },

  async signUp(email, password, name, role, captchaToken) {
    const result = await api.signUp({ email, password, name, role, captchaToken });
    let session = result.session;
    if (!session) {
      // No session back usually means Supabase still has "Confirm email" switched on
      try { await api.signIn({ email, password }); }
      catch { throw new Error('Account created, but sign-in is blocked. Council must turn off "Confirm email" in Supabase (Authentication → Providers → Email).'); }
      session = (await supabase.auth.getSession()).data.session;
    }
    if (!session) throw new Error('Account created, but could not sign in. Please try signing in.');
    const profile = await api.getProfile(session.user.id);
    rememberProfile(profile);
    set({ userId: session.user.id, profile, role: profile?.role || role, authed: true, offlineSession: false });
  },

  async refreshProfile(force = false) {
    const { userId, profile: current } = get();
    if (!HAS_SUPABASE || !userId) return;
    // Picks up role changes made by council; once a minute is plenty (it used to run on every page change)
    if (!force && Date.now() - lastProfileCheck < 60_000) return;
    lastProfileCheck = Date.now();
    const profile = await api.getProfile(userId);
    if (!profile) return;
    rememberProfile(profile);
    if (profile.role !== current?.role || profile.contractor_id !== current?.contractor_id || profile.name !== current?.name) {
      set({ profile, role: profile.role });
    }
  },

  async signOut() {
    rememberProfile(null);
    clearCopies();
    // This phone shouldn't keep getting the signed-out person's notifications
    await import('../lib/push').then(m => m.disablePush()).catch(() => {});
    await api.signOut();
    set({ userId: null, profile: null, authed: false, role: get().demoRole, offlineSession: false });
  },

  setDemoRole(r) {
    const name = r === 'admin' ? 'Council Officer' : r === 'contractor' ? 'Demo Contractor' : 'Demo Resident';
    const now = new Date().toISOString();
    set({
      demoRole: r, role: r, authed: true, userId: `demo-${r}`,
      profile: {
        id: `demo-${r}`, email: `${r}@demo.local`, name, role: r, phone: null, suburb: null,
        contractor_id: r === 'contractor' ? 'demo-contractor' : null, avatar_url: null, created_at: now, updated_at: now,
      },
    });
  },
  setDemoAuthed(b) {
    set({ authed: b });
  },
}));
