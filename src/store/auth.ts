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
  setDemoRole: (r: Role) => void;
  setDemoAuthed: (b: boolean) => void;
  authed: boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  ready: false,
  userId: null,
  profile: null,
  role: 'citizen',
  demoRole: 'citizen',
  authed: false,

  async init() {
    if (!HAS_SUPABASE) {
      set({ ready: true });
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const profile = await api.getProfile(data.session.user.id);
      set({
        ready: true,
        userId: data.session.user.id,
        profile,
        role: profile?.role || 'citizen',
        authed: true,
      });
    } else {
      set({ ready: true });
    }
    supabase.auth.onAuthStateChange(async (_evt, session) => {
      if (session) {
        const profile = await api.getProfile(session.user.id);
        set({ userId: session.user.id, profile, role: profile?.role || 'citizen', authed: true });
      } else {
        set({ userId: null, profile: null, role: get().demoRole, authed: false });
      }
    });
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

  async signOut() {
    await api.signOut();
    set({ userId: null, profile: null, authed: false, role: get().demoRole });
  },

  setDemoRole(r) {
    set({ demoRole: r, role: r, authed: true });
  },
  setDemoAuthed(b) {
    set({ authed: b });
  },
}));
