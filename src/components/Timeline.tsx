import type { RepairUpdate } from '../lib/types';
import { relativeTime } from '../lib/utils';
import { IconCheck, IconClock } from '../lib/icons';

export function Timeline({ updates }: { updates: RepairUpdate[] }) {
  return (
    <div className="grid gap-0">
      {updates.map((u, i) => {
        const isLast = i === updates.length - 1;
        const done = u.progress === 100;
        return (
          <div key={u.id} className="grid grid-cols-[32px_1fr] gap-3.5 pb-5 relative">
            {!isLast && <span className="absolute left-[15.5px] top-[30px] bottom-0 w-0.5 bg-border" />}
            <div className={`w-8 h-8 rounded-full grid place-items-center border-2 z-10 ${done ? 'bg-em-600 border-em-600 text-white' : 'bg-surface-2 border-border text-muted'}`}>
              {done ? <IconCheck size={14} /> : <IconClock size={14} />}
            </div>
            <div className="pt-1">
              <div className="text-[13.5px] font-semibold text-ink">{u.action}</div>
              <div className="text-[11.5px] text-muted mt-0.5">
                {u.actor_role ? u.actor_role.charAt(0).toUpperCase() + u.actor_role.slice(1) : 'System'}
                {' · '}
                {relativeTime(u.created_at)}
              </div>
              {u.note && <div className="text-[13px] text-ink-2 mt-1.5">{u.note}</div>}
              {typeof u.progress === 'number' && u.progress > 0 && (
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 prog"><i style={{ width: `${u.progress}%` }} /></div>
                  <span className="mono text-xs text-muted">{u.progress}%</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
