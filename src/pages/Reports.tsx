import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useUI } from '../store/ui';
import { dueDate, slaStatus } from '../lib/sla';
import { TYPES } from '../lib/constants';
import { ColumnChart, BarList } from '../components/Charts';
import type { Contractor, Defect, RepairUpdate } from '../lib/types';

type Milestone = Pick<RepairUpdate, 'defect_id' | 'action' | 'created_at'>;
const RANGES = [3, 6, 12] as const;
const DAY = 86400000;

const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
const days = (from: string, to: string) => (+new Date(to) - +new Date(from)) / DAY;
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const oneDp = (n: number) => (Math.round(n * 10) / 10).toLocaleString();
/** Durations in days, shown as hours when under a day ("3 h", "4.5 d"). */
const duration = (d: number) => (d < 1 ? `${Math.max(1, Math.round(d * 24))} h` : `${oneDp(d)} d`);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);

export function ReportsPage() {
  const { toast } = useUI();
  const [range, setRange] = useState<(typeof RANGES)[number]>(6);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([api.listDefects({}), api.listContractors(), api.listMilestones()])
      .then(([d, c, m]) => { setDefects(d); setContractors(c); setMilestones(m); })
      .catch((err) => toast('error', 'Could not load reports', err.message || 'Please refresh.'))
      .finally(() => setLoaded(true));
  }, [toast]);

  const r = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: range }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (range - 1 - i), 1));
    const start = months[0];
    const labels = months.map((m, i) =>
      m.toLocaleDateString('en-AU', { month: 'short', ...(i === 0 || m.getMonth() === 0 ? { year: '2-digit' } : {}) }));
    const idx = new Map(months.map((m, i) => [monthKey(m), i]));
    const inRange = (iso: string | null | undefined) => !!iso && new Date(iso) >= start;

    // First assignment and last completion per defect, from the timeline
    const firstAssigned = new Map<string, string>();
    const lastComplete = new Map<string, string>();
    for (const m of milestones) {
      if (m.action === 'Assigned' && !firstAssigned.has(m.defect_id)) firstAssigned.set(m.defect_id, m.created_at);
      if (m.action === 'Repair complete') lastComplete.set(m.defect_id, m.created_at);
    }

    const received = months.map(() => 0);
    const verified = months.map(() => 0);
    const fixDaysByMonth: number[][] = months.map(() => []);
    for (const d of defects) {
      const ri = idx.get(monthKey(new Date(d.reported_at)));
      if (ri != null) received[ri]++;
      if (d.verified_at) {
        const vi = idx.get(monthKey(new Date(d.verified_at)));
        if (vi != null) { verified[vi]++; fixDaysByMonth[vi].push(days(d.reported_at, d.verified_at)); }
      }
    }

    const reportedInRange = defects.filter(d => inRange(d.reported_at));
    const verifiedInRange = defects.filter(d => inRange(d.verified_at));
    const fixDays = verifiedInRange.map(d => days(d.reported_at, d.verified_at!));
    const onTime = verifiedInRange.filter(d => +new Date(d.verified_at!) <= +dueDate(d)).length;
    const assignDays = reportedInRange.filter(d => firstAssigned.has(d.id)).map(d => days(d.reported_at, firstAssigned.get(d.id)!));

    const byType = TYPES.map(t => ({ label: t.label, value: reportedInRange.filter(d => d.defect_type === t.id).length }))
      .filter(x => x.value > 0).sort((a, b) => b.value - a.value);

    const byContractor = contractors.map(c => {
      const jobs = defects.filter(d => d.contractor_id === c.id);
      const done = jobs.filter(d => inRange(d.verified_at));
      const turnaround = jobs
        .filter(d => firstAssigned.has(d.id) && lastComplete.has(d.id) && inRange(lastComplete.get(d.id)))
        .map(d => days(firstAssigned.get(d.id)!, lastComplete.get(d.id)!));
      return {
        c,
        open: jobs.filter(d => d.status === 'assigned' || d.status === 'progress').length,
        overdue: jobs.filter(d => slaStatus(d)?.overdue).length,
        verified: done.length,
        onTime: pct(done.filter(d => +new Date(d.verified_at!) <= +dueDate(d)).length, done.length),
        turnaround: median(turnaround),
      };
    }).sort((a, b) => b.verified - a.verified || b.open - a.open);

    return {
      labels, received, verified,
      medianFix: fixDaysByMonth.map(xs => { const m = median(xs); return m == null ? null : Math.round(m * 10) / 10; }),
      kpi: {
        received: reportedInRange.length,
        verified: verifiedInRange.length,
        medianFix: median(fixDays),
        onTime: pct(onTime, verifiedInRange.length),
        medianAssign: median(assignDays),
        overdueNow: defects.filter(d => slaStatus(d)?.overdue).length,
      },
      byType, byContractor,
    };
  }, [defects, contractors, milestones, range]);

  const k = r.kpi;
  const tiles = [
    { label: 'Reports received', value: k.received.toLocaleString(), note: `last ${range} months` },
    { label: 'Repairs verified', value: k.verified.toLocaleString(), note: `last ${range} months` },
    { label: 'Median time to fix', value: k.medianFix == null ? '—' : duration(k.medianFix), note: 'report → verified' },
    { label: 'Fixed on time', value: k.onTime == null ? '—' : `${k.onTime}%`, note: 'verified within deadline' },
    { label: 'Median time to assign', value: k.medianAssign == null ? '—' : duration(k.medianAssign), note: 'report → contractor assigned' },
  ];

  return (
    <main className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <span className="section-label">Council</span>
          <h1 className="mt-1">Reports</h1>
          <p className="text-muted mt-1">How quickly defects are being fixed, and by whom.</p>
        </div>
      </div>

      {/* One filter row that scopes everything below */}
      <div className="flex flex-wrap items-center gap-2 mb-6" role="group" aria-label="Time range">
        <span className="text-[12.5px] font-semibold text-muted mr-1">Last</span>
        {RANGES.map(n => (
          <button key={n} onClick={() => setRange(n)} aria-pressed={range === n} className="chip !h-8 whitespace-nowrap">{n} months</button>
        ))}
      </div>

      <div className={`transition-opacity ${loaded ? '' : 'opacity-50'}`}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {tiles.map(t => (
            <div key={t.label} className="card p-4">
              <div className="text-[12px] font-semibold text-muted">{t.label}</div>
              <div className="text-[26px] font-bold tracking-tight text-ink mt-1 leading-tight">{t.value}</div>
              <div className="text-[11.5px] text-muted mt-0.5">{t.note}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5 mb-5">
          <section className="card p-5">
            <h3 className="text-[17px]">Reports received vs repairs verified</h3>
            <p className="text-[12.5px] text-muted mb-4">Per month. When verified keeps up with received, the backlog isn't growing.</p>
            <ColumnChart
              title="Reports received and repairs verified per month"
              categories={r.labels}
              series={[
                { key: 'received', label: 'Received', color: 'var(--series-1)', values: r.received },
                { key: 'verified', label: 'Verified', color: 'var(--series-2)', values: r.verified },
              ]}
            />
          </section>
          <section className="card p-5">
            <h3 className="text-[17px]">What's being reported</h3>
            <p className="text-[12.5px] text-muted mb-4">Reports by defect type, last {range} months.</p>
            <BarList rows={r.byType} color="var(--series-1)" empty="No reports in this period." />
          </section>
        </div>

        <section className="card p-5 mb-5">
          <h3 className="text-[17px]">Median days to fix</h3>
          <p className="text-[12.5px] text-muted mb-4">From report to council verification, for repairs verified each month. Lower is better.</p>
          <ColumnChart
            title="Median days from report to verified repair, per month"
            categories={r.labels}
            series={[{ key: 'days', label: 'Median days', color: 'var(--series-1)', values: r.medianFix }]}
            format={(n) => oneDp(n)}
            height={200}
            empty="No repairs were verified in this period."
          />
        </section>

        <section className="card overflow-hidden">
          <div className="card-head">
            <h3 className="flex-1 text-[17px]">Contractor performance</h3>
            <span className="text-[12px] text-muted">Verified and turnaround: last {range} months · open and overdue: now</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-surface-2 border-b border-border">
                  {['Contractor', 'Open jobs', 'Overdue', 'Verified', 'On time', 'Median turnaround'].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-muted whitespace-nowrap ${i ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.byContractor.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted">No contractors yet.</td></tr>
                )}
                {r.byContractor.map(x => (
                  <tr key={x.c.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-semibold text-ink">{x.c.name}</td>
                    <td className="px-4 py-3 text-right mono">{x.open}</td>
                    <td className={`px-4 py-3 text-right mono ${x.overdue ? 'text-rd-600 font-bold' : ''}`}>{x.overdue}</td>
                    <td className="px-4 py-3 text-right mono">{x.verified}</td>
                    <td className="px-4 py-3 text-right mono">{x.onTime == null ? '—' : `${x.onTime}%`}</td>
                    <td className="px-4 py-3 text-right mono">{x.turnaround == null ? '—' : duration(x.turnaround)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-[12px] text-muted border-t border-border">
            Turnaround is from council assigning the job to the contractor marking it complete. {k.overdueNow > 0 && <b className="text-rd-600">{k.overdueNow} open defect{k.overdueNow === 1 ? ' is' : 's are'} overdue right now.</b>}
          </p>
        </section>
      </div>
    </main>
  );
}
