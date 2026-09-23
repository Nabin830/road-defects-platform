import { useUI } from '../store/ui';
import { IconCheckCircle, IconAlert, IconBell, IconX } from '../lib/icons';

export function ToastHost() {
  const { toasts, dismissToast } = useUI();
  return (
    <div className="fixed top-4 right-4 z-[9500] grid gap-2.5 w-[340px] max-w-[calc(100vw-2rem)]">
      {toasts.map(t => {
        const color = t.kind === 'success' ? 'var(--em-600, #059669)'
                    : t.kind === 'error'   ? '#DC2626'
                    : t.kind === 'warning' ? '#F59E0B' : '#0EA5E9';
        const borderL = t.kind === 'success' ? 'border-l-em-600'
                      : t.kind === 'error'   ? 'border-l-rd-600'
                      : t.kind === 'warning' ? 'border-l-am-500' : 'border-l-sky-500';
        const Icon = t.kind === 'success' ? IconCheckCircle : t.kind === 'error' ? IconAlert : t.kind === 'warning' ? IconAlert : IconBell;
        return (
          <div key={t.id}
               className={`flex gap-3 px-3.5 py-3 rounded-[10px] bg-surface border border-border border-l-4 ${borderL} shadow-xl animate-slide-in`}>
            <span style={{ color, marginTop: 1 }}><Icon size={18} /></span>
            <div className="flex-1">
              <div className="text-[13.5px] font-bold text-ink">{t.title}</div>
              {t.message && <div className="text-[12.5px] text-muted">{t.message}</div>}
            </div>
            <button onClick={() => dismissToast(t.id)}
                    className="w-5 h-5 grid place-items-center text-muted hover:text-ink"
                    aria-label="Dismiss">
              <IconX size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
