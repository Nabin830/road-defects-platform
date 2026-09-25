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

/** Saved theme; browser storage can be blocked (e.g. some private modes), so never let that break start-up. */
function savedTheme(): 'light' | 'dark' {
  try {
    const t = localStorage.getItem('roadfix-theme') ?? localStorage.getItem('rdap-theme');
    return t === 'dark' ? 'dark' : 'light';
  } catch { return 'light'; }
}

export const useUI = create<UIState>((set, get) => ({
  theme: savedTheme(),
  sim: 'desktop',
  toasts: [],
  modal: null,

  toggleTheme() { get().setTheme(get().theme === 'dark' ? 'light' : 'dark'); },
  setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('roadfix-theme', t); localStorage.removeItem('rdap-theme'); } catch {}
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
