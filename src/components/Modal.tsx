import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useUI } from '../store/ui';

export function ModalHost() {
  const { modal, closeModal } = useUI();
  const box = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  // A dialog belongs to the page that opened it — close it if the user navigates away (e.g. Back)
  useEffect(() => { closeModal(); }, [pathname, closeModal]);

  useEffect(() => {
    if (!modal) return;
    const opener = document.activeElement as HTMLElement | null;
    // Move keyboard/screen-reader focus into the dialog
    const first = box.current?.querySelector<HTMLElement>('textarea, input:not([type=hidden]), select, button:not([disabled])');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
      if (e.key !== 'Tab' || !box.current) return;
      // Keep Tab inside the dialog
      const items = [...box.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input:not([type=hidden]), select')];
      if (!items.length) return;
      const [a, z] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';            // don't scroll the page behind the dialog
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();                                 // give focus back to what opened it
    };
  }, [modal, closeModal]);

  if (!modal) return null;
  return (
    <div className="fixed inset-0 z-[9000] bg-black/45 backdrop-blur-sm grid place-items-center p-4 sm:p-5"
         onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div ref={box} role="dialog" aria-modal="true"
           className="w-full max-w-[480px] max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface border border-border rounded-2xl shadow-xl animate-slide-up">
        {modal}
      </div>
    </div>
  );
}
