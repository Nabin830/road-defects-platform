import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { DefectMap } from '../components/DefectMap';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/Badge';
import { SeverityChip } from '../components/Severity';
import { IconChart, IconWrench, IconUsers, IconTrend, IconAlert, IconStar, IconDownload } from '../lib/icons';
import { STATUS, SEVERITY } from '../lib/constants';
import { relativeTime } from '../lib/utils';
import { useUI } from '../store/ui';
import { slaStatus } from '../lib/sla';
import { SlaChip } from '../components/SlaChip';
import type { Defect, Contractor, DefectStatus, Severity as Sev } from '../lib/types';

export function AdminPage() {
  const { toast } = useUI();
  const [defects, setDefects] = useState<Defect[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);

  useEffect(() => {
    api.listDefects({}).then(setDefects).catch(() => {});
    api.listContractors().then(setContractors).catch(() => {});
  }, []);

  const total = defects.length;
  const byStatus: Record<DefectStatus, number> = { pending: 0, assigned: 0, progress: 0, completed: 0, rejected: 0 };
  const bySeverity: Record<Sev, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const d of defects) { byStatus[d.status]++; bySeverity[d.severity]++; }

  const pending = defects.filter(d => d.status === 'pending');
  const toVerify = defects.filter(d => d.status === 'completed' && !d.verified_at);
  const overdue = defects.filter(d => slaStatus(d)?.overdue);

  function exportCsv() {
    if (defects.length === 0) return toast('warning', 'Nothing to export', 'No defects loaded yet.');
    const cols: (keyof Defect)[] = ['id', 'title', 'defect_type', 'severity', 'status', 'road', 'suburb', 'latitude', 'longitude', 'votes', 'progress', 'reported_at', 'contractor_id'];
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(','), ...defects.map(d => cols.map(c => esc(d[c])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `defects-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('success', 'CSV downloaded', `${defects.length} defects exported.`);
  }

  return (
    <main className="w-full max-w-[1280px] mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <span className="section-label">Council</span>
          <h1 className="mt-1">Overview</h1>
          <p className="text-muted mt-1">Everything reported to council, and where each repair is up to.</p>
        </div>
        <button onClick={exportCsv} className="btn btn-secondary"><IconDownload size={16} /> Export CSV</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard k="Total defects" v={total} d="live in the program" icon={<IconChart size={16} />} color="var(--brand-text)" bg="var(--brand-soft)" />
        <StatCard k="Pending triage" v={pending.length} d="new reports" icon={<IconAlert size={16} />} color="#B45309" bg="#FFFBEB" />
        <StatCard k="Overdue" v={overdue.length} d="past their deadline" icon={<IconStar size={16} />} color="#B91C1C" bg="#FEF2F2" />
        <StatCard k="Awaiting sign-off" v={toVerify.length} d="repairs to verify" icon={<IconUsers size={16} />} color="#047857" bg="#ECFDF5" />
      </div>

      {/* What council needs to act on */}
      <div className="grid lg:grid-cols-2 gap-5 mb-8">
        <ActionList
          title="New reports to triage"
          empty="No new reports waiting."
          rows={pending.slice(0, 8).map(d => ({ d, meta: `${d.road} · reported ${relativeTime(d.reported_at)}` }))}
          cta="Assign"
          ctaCls="btn-primary"
        />
        <ActionList
          title="Repairs awaiting verification"
          empty="No finished repairs to check."
          rows={toVerify.map(d => ({ d, meta: `${contractors.find(c => c.id === d.contractor_id)?.name || 'Contractor'} · marked complete ${relativeTime(d.updated_at)}` }))}
          cta="Review"
          ctaCls="btn-success"
        />
      </div>

      <div className="grid xl:grid-cols-3 gap-5 mb-8">
        {/* Status bars */}
        <div className="card p-5 xl:col-span-2">
          <h3 className="mb-4">By status</h3>
          <div className="flex items-end gap-4 h-48 pt-2">
            {(['pending', 'assigned', 'progress', 'completed', 'rejected'] as const).map(k => {
              const n = byStatus[k];
              const pct = total ? Math.round((n / total) * 100) : 0;
              return (
                <div key={k} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div className="mono text-xs font-bold">{n}</div>
                  <div className="w-full max-w-[56px] rounded-t-md transition-all"
                       style={{ height: `${Math.max(6, pct * 1.6)}%`, background: STATUS[k].color }} />
                  <div className="text-[11px] font-semibold text-muted text-center">{STATUS[k].label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Severity donut */}
        <div className="card p-5">
          <h3 className="mb-4">By severity</h3>
          <div className="grid gap-2.5">
            {(['critical', 'high', 'medium', 'low'] as const).map(s => {
              const n = bySeverity[s];
              const pct = total ? Math.round((n / total) * 100) : 0;
              return (
                <div key={s}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-[13px]">
                      <i className="w-2.5 h-2.5 rounded-full block" style={{ background: SEVERITY[s].color }} />
                      <span className="font-semibold">{SEVERITY[s].label}</span>
                    </div>
                    <span className="mono text-xs font-bold">{n} <span className="text-muted">({pct}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: SEVERITY[s].color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contractors table + map */}
      <div className="grid xl:grid-cols-[minmax(0,1fr)_420px] gap-5 mb-8">
        <div className="card">
          <div className="card-head">
            <h3 className="flex-1">Contractor performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-surface-2 border-b border-border">
                  {['Contractor', 'Assigned', 'In progress', 'Completed'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contractors.map(c => {
                  const jobs = defects.filter(d => d.contractor_id === c.id);
                  const a = jobs.filter(d => d.status === 'assigned').length;
                  const p = jobs.filter(d => d.status === 'progress').length;
                  const d30 = jobs.filter(d => d.status === 'completed').length;
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 grid place-items-center text-xs font-bold">{c.abbr}</span>
                          <span className="font-semibold text-ink">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 mono">{a}</td>
                      <td className="px-4 py-3 mono">{p}</td>
                      <td className="px-4 py-3 mono">{d30}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-4">
          <h4 className="mb-3">All defects</h4>
          <DefectMap defects={defects} height={340} />
        </div>
      </div>

    </main>
  );
}

function ActionList({ title, empty, rows, cta, ctaCls }: {
  title: string; empty: string; rows: { d: Defect; meta: string }[]; cta: string; ctaCls: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="card-head">
        <h3 className="flex-1 text-[17px]">{title}</h3>
        <span className={`mono text-[11px] font-bold px-2 py-0.5 rounded-pill border ${rows.length ? 'bg-brand text-brand-ink border-brand' : 'bg-surface-2 text-muted border-border'}`}>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-[13px] text-muted">{empty}</div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map(({ d, meta }) => (
            <Link key={d.id} to={`/defect/${d.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2 hover:no-underline">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink truncate">{d.title}</span>
                  <SeverityChip level={d.severity} />
                </div>
                <div className="text-[12px] text-muted truncate mt-0.5">{d.id} · {meta}</div>
                <SlaChip d={d} className="mt-1" />
              </div>
              <span className={`btn btn-sm ${ctaCls}`}>{cta}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
