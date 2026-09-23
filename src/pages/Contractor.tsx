import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { StatCard } from '../components/StatCard';
import { SeverityChip } from '../components/Severity';
import { StatusBadge } from '../components/Badge';
import { IconWrench, IconCheckCircle, IconClock, IconStar } from '../lib/icons';
import { relativeTime } from '../lib/utils';
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
    <main className="w-full max-w-[1560px] mx-auto px-6 py-8">
      <div className="mb-6">
        <span className="section-label">Contractor{contractor ? ` · ${contractor.name}` : ''}</span>
        <h1 className="mt-1">Hi {profile?.name?.split(' ')[0] || 'there'}, you have {assigned.length + progress.length} active assignments</h1>
        <p className="text-muted mt-1">Kanban view of all work assigned to your crew.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard k="Total assigned" v={rows.length} d="all statuses" icon={<IconWrench size={16} />} color="#1E40AF" bg="#EFF6FF" />
        <StatCard k="Awaiting start" v={assigned.length} d="ready to schedule" icon={<IconClock size={16} />} color="#B45309" bg="#FFFBEB" />
        <StatCard k="In progress" v={progress.length} d="crew on site" icon={<IconStar size={16} />} color="#6D28D9" bg="#F5F3FF" />
        <StatCard k="Completed" v={done.length} d="awaiting inspection" icon={<IconCheckCircle size={16} />} color="#047857" bg="#ECFDF5" />
      </div>

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
            <div className="text-[12px] text-muted mb-2 line-clamp-1">{r.road}</div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{relativeTime(r.reported_at)}</span>
              <StatusBadge status={r.status} />
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
