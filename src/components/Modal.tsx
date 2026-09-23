import { useUI } from '../store/ui';

export function ModalHost() {
  const { modal, closeModal } = useUI();
  if (!modal) return null;
  return (
    <div className="fixed inset-0 z-[9000] bg-black/45 backdrop-blur-sm grid place-items-center p-5"
         onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div role="dialog" aria-modal="true"
           className="w-full max-w-[480px] bg-surface border border-border rounded-2xl shadow-xl overflow-hidden animate-slide-up">
        {modal}
      </div>
    </div>
  );
}
