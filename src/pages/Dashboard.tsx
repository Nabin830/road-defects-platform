import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { StatCard } from '../components/StatCard';
import { DefectMap } from '../components/DefectMap';
import { StatusBadge } from '../components/Badge';
import { SeverityChip } from '../components/Severity';
import { IconPlus, IconMap, IconFile, IconCheckCircle, IconClock, IconAlert } from '../lib/icons';
import { relativeTime } from '../lib/utils';
import type { Defect } from '../lib/types';

export function DashboardPage() {
  const { userId, profile, demoRole } = useAuth();
  const [mine, setMine] = useState<Defect[]>([]);
  const [all, setAll] = useState<Defect[]>([]);

  useEffect(() => {
    if (!userId) return;
    api.myReports(userId).then(setMine).catch(() => {});
    api.listDefects({}, userId).then(setAll).catch(() => {});
  }, [userId, demoRole]);

  const c = {
    total: mine.length,
    pending: mine.filter(d => d.status === 'pending').length,
    active: mine.filter(d => d.status === 'assigned' || d.status === 'progress').length,
    done: mine.filter(d => d.status === 'completed').length,
  };

  const name = profile?.name || 'there';
  const firstName = name.split(' ')[0];

  return (
    <main className="w-full max-w-[1280px] mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <span className="section-label">Citizen dashboard</span>
          <h1 className="mt-1">Welcome back, {firstName}</h1>
          <p className="text-muted mt-1">Track your reports and see what's happening on the roads near you.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/defects" className="btn btn-secondary hover:no-underline"><IconMap size={16} /> Public map</Link>
          <Link to="/report" className="btn btn-primary hover:no-underline"><IconPlus size={16} /> Report a defect</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard k="My reports" v={c.total} d="all time" icon={<IconFile size={17} />} color="#1E40AF" bg="#EFF6FF" />
        <StatCard k="Pending" v={c.pending} d="awaiting triage" icon={<IconClock size={17} />} color="#B45309" bg="#FFFBEB" />
        <StatCard k="Active repairs" v={c.active} d="assigned or in progress" icon={<IconAlert size={17} />} color="#6D28D9" bg="#F5F3FF" />
        <StatCard k="Completed" v={c.done} d="thanks for reporting!" icon={<IconCheckCircle size={17} />} color="#047857" bg="#ECFDF5" />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <section className="card">
          <div className="card-head">
            <h3 className="flex-1">My recent reports</h3>
            <Link to="/my-reports" className="btn btn-ghost btn-sm hover:no-underline">See all</Link>
          </div>
          <div className="card-body p-0">
            {mine.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-muted mb-4">No reports yet.</p>
                <Link to="/report" className="btn btn-primary hover:no-underline"><IconPlus size={16} /> Report your first defect</Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {mine.slice(0, 5).map(d => (
                  <Link key={d.id} to={`/defect/${d.id}`}
                        className="flex items-center gap-4 p-4 hover:bg-surface-2 hover:no-underline">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-700 grid place-items-center font-bold mono text-[11px] flex-none">{d.id.slice(-4)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-ink truncate">{d.title}</div>
                      <div className="text-[12.5px] text-muted mt-0.5 truncate">{d.road} · {relativeTime(d.reported_at)}</div>
                    </div>
                    <SeverityChip level={d.severity} />
                    <StatusBadge status={d.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card p-4">
            <h4 className="mb-3">Defects near you</h4>
            <DefectMap defects={all.slice(0, 20)} height={280} />
          </div>
          <div className="card p-5 hero-grad">
            <h4 className="mb-2">Spotted a hazard?</h4>
            <p className="text-[13px] text-muted mb-4">Snap a photo, drop a pin — takes about 60 seconds.</p>
            <Link to="/report" className="btn btn-primary btn-block hover:no-underline"><IconPlus size={16} /> Report a defect</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
