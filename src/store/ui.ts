import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';
export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface UIState {
  theme: 'light' | 'dark';
  sim: 'desktop' | 'mobile';
  toasts: Toast[];
  modal: React.ReactNode | null;
  toggleTheme: () => void;
  setTheme: (t: 'light' | 'dark') => void;
  setSim: (s: 'desktop' | 'mobile') => void;
  toast: (kind: ToastKind, title: string, message?: string) => void;
  dismissToast: (id: number) => void;
  openModal: (node: React.ReactNode) => void;
  closeModal: () => void;
}

let toastSeq = 0;

export const useUI = create<UIState>((set, get) => ({
  theme: (typeof localStorage !== 'undefined' && (localStorage.getItem('rdap-theme') as 'light' | 'dark')) || 'light',
  sim: 'desktop',
  toasts: [],
  modal: null,

  toggleTheme() { get().setTheme(get().theme === 'dark' ? 'light' : 'dark'); },
  setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('rdap-theme', t); } catch {}
    set({ theme: t });
  },
  setSim(s) {
    document.body.classList.toggle('mobile-sim', s === 'mobile');
    set({ sim: s });
  },
  toast(kind, title, message) {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts, { id, kind, title, message }] });
    setTimeout(() => get().dismissToast(id), 5000);
  },
  dismissToast(id) {
    set({ toasts: get().toasts.filter(t => t.id !== id) });
  },
  openModal(node) { set({ modal: node }); },
  closeModal() { set({ modal: null }); },
}));
