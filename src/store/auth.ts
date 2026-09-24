import { create } from 'zustand';
import { HAS_SUPABASE, supabase } from '../lib/supabase';
import { api } from '../lib/api';
import type { Profile, Role } from '../lib/types';

interface AuthState {
  ready: boolean;
  userId: string | null;
  profile: Profile | null;
  role: Role;                    // best-effort — 'citizen' when signed out
  demoRole: Role;                // used when Supabase not configured
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns true if the new account is signed in immediately, false if email confirmation is required. */
  signUp: (email: string, password: string, name: string, role: Role) => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Re-read the signed-in user's profile (role, contractor link) from the database. */
  refreshProfile: () => Promise<void>;
  setDemoRole: (r: Role) => void;
  setDemoAuthed: (b: boolean) => void;
  authed: boolean;
  /** True after opening a password-reset email link, until a new password is set. */
  recovery: boolean;
  setRecovery: (b: boolean) => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  ready: false,
  userId: null,
  profile: null,
  role: 'citizen',
  demoRole: 'citizen',
  authed: false,
  recovery: false,
  setRecovery(b) { set({ recovery: b }); },

  async init() {
    if (!HAS_SUPABASE) {
      set({ ready: true });
      return;
    }
    // Arrived from a password-reset email (see api.requestPasswordReset)
    if (new URLSearchParams(window.location.search).has('reset')) set({ recovery: true });

    // Subscribe before reading the session so events fired while the client
    // processes an email link (e.g. PASSWORD_RECOVERY) aren't missed.
    supabase.auth.onAuthStateChange((evt, session) => {
      if (evt === 'PASSWORD_RECOVERY') set({ recovery: true });
      if (!session) {
        set({ userId: null, profile: null, role: get().demoRole, authed: false });
        return;
      }
      // Supabase calls made directly inside this callback can deadlock the client,
      // so load the profile on the next tick.
      const uid = session.user.id;
      setTimeout(async () => {
        const profile = await api.getProfile(uid);
        set({ userId: uid, profile, role: profile?.role || 'citizen', authed: true });
      }, 0);
    });

    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const profile = await api.getProfile(data.session.user.id);
      set({ ready: true, userId: data.session.user.id, profile, role: profile?.role || 'citizen', authed: true });
    } else {
      set({ ready: true });
    }
  },

  async signIn(email, password) {
    await api.signIn({ email, password });
    // onAuthStateChange will fire, but wait a tick and force refresh just in case
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const profile = await api.getProfile(data.session.user.id);
      set({ userId: data.session.user.id, profile, role: profile?.role || 'citizen', authed: true });
    }
  },

  async signUp(email, password, name, role) {
    const result = await api.signUp({ email, password, name, role });
    // Some Supabase projects return a session directly on signUp (confirm-email OFF).
    if (result.session) {
      const profile = await api.getProfile(result.session.user.id);
      set({ userId: result.session.user.id, profile, role: profile?.role || role, authed: true });
      return true;
    }
    // Otherwise try an immediate sign-in — works if confirm-email is OFF but signUp
    // didn't hand back a session for some reason; fails with "Email not confirmed"
    // if the project still requires confirmation.
    try {
      await api.signIn({ email, password });
    } catch {
      return false;
    }
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const profile = await api.getProfile(data.session.user.id);
      set({ userId: data.session.user.id, profile, role: profile?.role || role, authed: true });
      return true;
    }
    return false;
  },

  async refreshProfile() {
    const { userId, profile: current } = get();
    if (!HAS_SUPABASE || !userId) return;
    const profile = await api.getProfile(userId);
    if (!profile) return;
    if (profile.role !== current?.role || profile.contractor_id !== current?.contractor_id || profile.name !== current?.name) {
      set({ profile, role: profile.role });
    }
  },

  async signOut() {
    await api.signOut();
    set({ userId: null, profile: null, authed: false, role: get().demoRole });
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
