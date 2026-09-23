import { SEVERITY } from '../lib/constants';
import type { Severity } from '../lib/types';

const CLR: Record<Severity, string> = {
  low:      'text-[#15803D] dark:text-[#4ADE80]',
  medium:   'text-[#A16207] dark:text-[#FACC15]',
  high:     'text-[#C2410C] dark:text-[#FB923C]',
  critical: 'text-rd-600 dark:text-[#F87171]',
};

const DOT: Record<Severity, string> = {
  low: 'bg-[#16A34A]', medium: 'bg-[#EAB308]', high: 'bg-or-500', critical: 'bg-rd-600',
};

export function SeverityChip({ level }: { level: Severity }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${CLR[level]}`}>
      <i className={`w-2 h-2 rounded-full flex-none block ${DOT[level]} ${level === 'critical' ? 'pulse-critical' : ''}`} />
      {SEVERITY[level].label}
    </span>
  );
}
