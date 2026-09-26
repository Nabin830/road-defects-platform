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
  toasts: Toast[];
  modal: React.ReactNode | null;
  toggleTheme: () => void;
  setTheme: (t: 'light' | 'dark') => void;
  toast: (kind: ToastKind, title: string, message?: string) => void;
  dismissToast: (id: number) => void;
  openModal: (node: React.ReactNode) => void;
  closeModal: () => void;
}

let toastSeq = 0;

/** Saved theme; browser storage can be blocked (e.g. some private modes), so never let that break start-up. */
function savedTheme(): 'light' | 'dark' {
  try {
    const t = localStorage.getItem('roadfix-theme') ?? localStorage.getItem('rdap-theme');
    return t === 'dark' ? 'dark' : 'light';
  } catch { return 'light'; }
}

export const useUI = create<UIState>((set, get) => ({
  theme: savedTheme(),
  toasts: [],
  modal: null,

  toggleTheme() { get().setTheme(get().theme === 'dark' ? 'light' : 'dark'); },
  setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('roadfix-theme', t); localStorage.removeItem('rdap-theme'); } catch {}
    set({ theme: t });
  },
  toast(kind, title, message) {
    // The same message twice in a row (double click, retried load) shows once
    if (get().toasts.some(t => t.kind === kind && t.title === title && t.message === message)) return;
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
