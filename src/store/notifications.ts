import { create } from 'zustand';
import { api } from '../lib/api';
import { useUI } from './ui';
import type { AppNotification } from '../lib/types';

interface NotificationState {
  items: AppNotification[];
  userId: string | null;
  /** Start loading + live updates for this user (null stops everything). */
  watch: (userId: string | null) => void;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

let unsubscribe: (() => void) | null = null;
let poll: ReturnType<typeof setInterval> | null = null;

export const useNotifications = create<NotificationState>((set, get) => ({
  items: [],
  userId: null,

  watch(userId) {
    if (userId === get().userId) return;
    unsubscribe?.(); unsubscribe = null;
    if (poll) { clearInterval(poll); poll = null; }
    set({ userId, items: [] });
    if (!userId) return;

    get().refresh();
    unsubscribe = api.subscribeNotifications(userId, (n) => {
      if (get().items.some(i => i.id === n.id)) return;
      set({ items: [n, ...get().items] });
      useUI.getState().toast('info', n.title, n.defect_title || n.body || undefined);
    });
    // Safety net in case the live connection drops
    poll = setInterval(() => get().refresh(), 60_000);
  },

  async refresh() {
    const { userId } = get();
    if (!userId) return;
    try {
      const items = await api.listNotifications(userId);
      if (get().userId === userId) set({ items });
    } catch { /* keep what we have */ }
  },

  async markRead(id) {
    const { userId, items } = get();
    if (!userId) return;
    set({ items: items.map(i => i.id === id && !i.read_at ? { ...i, read_at: new Date().toISOString() } : i) });
    await api.markNotificationsRead(userId, [id]).catch(() => {});
  },

  async markAllRead() {
    const { userId, items } = get();
    if (!userId) return;
    const now = new Date().toISOString();
    set({ items: items.map(i => i.read_at ? i : { ...i, read_at: now }) });
    await api.markNotificationsRead(userId, 'all').catch(() => {});
  },
}));
