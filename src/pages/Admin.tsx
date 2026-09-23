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
  const critical = defects.filter(d => d.severity === 'critical' && d.status !== 'completed' && d.status !== 'rejected');
  const activeContractors = contractors.length;

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
    <main className="w-full max-w-[1560px] mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <span className="section-label">Admin · Orange City Council</span>
          <h1 className="mt-1">Program overview</h1>
          <p className="text-muted mt-1">All defects, all contractors, all channels.</p>
        </div>
        <button onClick={exportCsv} className="btn btn-secondary"><IconDownload size={16} /> Export CSV</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard k="Total defects" v={total} d="live in the program" icon={<IconChart size={16} />} color="#1E40AF" bg="#EFF6FF" />
        <StatCard k="Pending triage" v={pending.length} d="need review" icon={<IconAlert size={16} />} color="#B45309" bg="#FFFBEB" />
        <StatCard k="Critical open" v={critical.length} d="SLA under 24h" icon={<IconStar size={16} />} color="#B91C1C" bg="#FEF2F2" />
        <StatCard k="Contractors" v={activeContractors} d="on the panel" icon={<IconUsers size={16} />} color="#6D28D9" bg="#F5F3FF" />
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
            <span className="text-xs text-muted">This month</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-surface-2 border-b border-border">
                  {['Contractor', 'Crew', 'Assigned', 'In progress', 'Completed', 'Rating'].map(h => (
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
                      <td className="px-4 py-3 mono">{c.crew_size}</td>
                      <td className="px-4 py-3 mono">{a}</td>
                      <td className="px-4 py-3 mono">{p}</td>
                      <td className="px-4 py-3 mono">{d30}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-am-700">
                          <IconStar size={13} />
                          <span className="mono font-bold">{c.rating}</span>
                        </div>
                      </td>
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

      {/* Pending triage list */}
      {pending.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3 className="flex-1">Pending triage <span className="text-muted font-normal text-sm">— {pending.length}</span></h3>
          </div>
          <div className="divide-y divide-border">
            {pending.slice(0, 8).map(d => (
              <Link key={d.id} to={`/defect/${d.id}`} className="flex items-center gap-4 p-4 hover:bg-surface-2 hover:no-underline">
                <span className="mono text-xs text-muted w-14">{d.id}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-ink truncate">{d.title}</div>
                  <div className="text-[12px] text-muted truncate mt-0.5">{d.road} · {relativeTime(d.reported_at)}</div>
                </div>
                <SeverityChip level={d.severity} />
                <StatusBadge status={d.status} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
