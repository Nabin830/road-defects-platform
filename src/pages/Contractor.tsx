import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { SeverityChip } from '../components/Severity';
import { StatusBadge } from '../components/Badge';
import { relativeTime } from '../lib/utils';
import { SlaChip } from '../components/SlaChip';
import { slaStatus } from '../lib/sla';
import type { Contractor, Defect } from '../lib/types';

export function ContractorPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Defect[]>([]);
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const contractorId = profile?.contractor_id || null;

  useEffect(() => {
    if (!contractorId) { setRows([]); setContractor(null); return; }
    api.contractorQueue(contractorId).then(setRows).catch(() => {});
    api.listContractors().then(list => setContractor(list.find(c => c.id === contractorId) || null)).catch(() => {});
  }, [contractorId]);

  const assigned = rows.filter(r => r.status === 'assigned');
  const progress = rows.filter(r => r.status === 'progress');
  const done     = rows.filter(r => r.status === 'completed');
  const needsResponse = assigned.filter(r => !r.accepted_at).length;
  const lateJobs = rows.filter(r => slaStatus(r)?.overdue);
  const soonJobs = rows.filter(r => slaStatus(r)?.soon);

  if (!contractorId) {
    return (
      <main className="w-full max-w-[900px] mx-auto px-6 py-8">
        <div className="card p-10 text-center">
          <h1 className="mb-2">Not linked to a contractor account</h1>
          <p className="text-muted">Your login isn't attached to a contractor company yet. Ask council admin to link your
            profile to a contractor record — once that's done, your assigned work will appear here.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-[1280px] mx-auto px-6 py-8">
      <div className="mb-6">
        <span className="section-label">{contractor?.name || 'Contractor'}</span>
        <h1 className="mt-1">My jobs</h1>
        <p className="text-muted mt-1">
          {assigned.length + progress.length === 0
            ? 'No active jobs right now. New jobs from council will appear here.'
            : `${assigned.length + progress.length} active job${assigned.length + progress.length === 1 ? '' : 's'}`}
          {needsResponse > 0 && <> · <b className="text-am-700">{needsResponse} waiting for your response</b></>}
        </p>
      </div>

      {(lateJobs.length > 0 || soonJobs.length > 0) && (
        <div role="alert" className={`mb-5 p-4 rounded-card border ${lateJobs.length ? 'bg-rd-50 border-rd-600/30 text-rd-700' : 'bg-am-50 border-am-500/30 text-am-700'}`}>
          <div className="font-bold text-[14px] mb-1">
            {lateJobs.length > 0 && `${lateJobs.length} job${lateJobs.length === 1 ? ' is' : 's are'} overdue`}
            {lateJobs.length > 0 && soonJobs.length > 0 && ' · '}
            {soonJobs.length > 0 && `${soonJobs.length} due within 24 hours`}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            {[...lateJobs, ...soonJobs].map(r => (
              <Link key={r.id} to={`/defect/${r.id}`} className="font-semibold underline text-inherit">{r.id} · {r.title}</Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Column title="Assigned" count={assigned.length} rows={assigned} />
        <Column title="In progress" count={progress.length} rows={progress} accent="pu" />
        <Column title="Completed" count={done.length} rows={done} accent="em" />
      </div>
    </main>
  );
}

function Column({ title, count, rows, accent }: { title: string; count: number; rows: Defect[]; accent?: 'pu' | 'em' }) {
  return (
    <div className="bg-bg-alt border border-border rounded-card p-3">
      <header className="flex items-center gap-2 px-1 pb-3">
        <h4 className="flex-1">{title}</h4>
        <span className="mono text-[11px] font-bold px-2 py-0.5 rounded-pill bg-surface border border-border text-muted">{count}</span>
      </header>
      <div className="grid gap-2.5">
        {rows.length === 0 && <div className="p-8 text-center text-[12.5px] text-muted">Nothing here.</div>}
        {rows.map(r => (
          <Link key={r.id} to={`/defect/${r.id}`}
                className="card card-hover p-3.5 hover:no-underline block">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="mono text-xs text-muted">{r.id}</span>
              <SeverityChip level={r.severity} />
            </div>
            <div className="text-[14px] font-semibold text-ink line-clamp-2 mb-1">{r.title}</div>
            <div className="text-[12px] text-muted line-clamp-1">{r.road}</div>
            {r.work_instructions && r.status !== 'completed' && (
              <div className="mt-1.5 p-2 rounded-md bg-brand-soft text-[12px] text-ink-2 line-clamp-2">
                <b className="text-ink">To do:</b> {r.work_instructions}
              </div>
            )}
            <SlaChip d={r} className="mt-1" />
            <div className="mb-2" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{relativeTime(r.reported_at)}</span>
              {r.status === 'assigned' && !r.accepted_at
                ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-pill bg-amber-100 text-amber-800">Needs your response</span>
                : r.status === 'completed'
                  ? <span className={`text-[11px] font-bold px-2 py-0.5 rounded-pill ${r.verified_at ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                      {r.verified_at ? 'Verified' : 'Awaiting verification'}
                    </span>
                  : <StatusBadge status={r.status} />}
            </div>
            {r.progress > 0 && r.status !== 'completed' && (
              <div className="prog mt-2"><i style={{ width: `${r.progress}%` }} /></div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
