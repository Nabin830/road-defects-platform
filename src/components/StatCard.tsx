import type { ReactNode } from 'react';

interface Props { k: string; v: string | number; d?: string; icon?: ReactNode; color?: string; bg?: string; }
export function StatCard({ k, v, d, icon, color, bg }: Props) {
  return (
    <div className="card p-5 relative overflow-hidden">
      {icon && (
        <span className="absolute right-4 top-4 w-8 h-8 rounded-[9px] grid place-items-center"
              style={{ background: bg || 'var(--brand-soft, #EFF6FF)', color: color || '#1E40AF' }}>
          {icon}
        </span>
      )}
      <div className="text-[11.5px] font-bold tracking-widest uppercase text-muted">{k}</div>
      <div className="mono text-[30px] font-bold tracking-tight leading-tight mt-0.5">{v}</div>
      {d && <div className="text-xs text-muted mt-0.5">{d}</div>}
    </div>
  );
}
