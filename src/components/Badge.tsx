import { STATUS } from '../lib/constants';
import type { DefectStatus } from '../lib/types';

export function StatusBadge({ status }: { status: DefectStatus }) {
  const s = STATUS[status];
  return (
    <span className={`badge ${s.cls}`}>
      <span className="dot" />
      {s.label}
    </span>
  );
}
