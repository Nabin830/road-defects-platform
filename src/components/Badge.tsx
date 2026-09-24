import { STATUS } from '../lib/constants';
import type { DefectStatus } from '../lib/types';

/** `verified` only matters for completed jobs: false = contractor finished, council hasn't signed off yet. */
export function StatusBadge({ status, verified }: { status: DefectStatus; verified?: boolean }) {
  const s = status === 'completed' && verified === false
    ? { label: 'Awaiting sign-off', cls: 'b-assigned' }
    : STATUS[status];
  return (
    <span className={`badge ${s.cls}`}>
      <span className="dot" />
      {s.label}
    </span>
  );
}
