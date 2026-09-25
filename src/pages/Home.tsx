import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { StatCard } from '../components/StatCard';
import { DefectMap } from '../components/DefectMap';
import { DefectCard } from '../components/DefectCard';
import { IconArrow, IconPlus, IconMap, IconShield, IconCamera, IconCrosshair, IconCheckCircle } from '../lib/icons';
import type { Defect, PlatformStats } from '../lib/types';
import { BrandLogo } from '../components/Brand';
import { useAuth } from '../store/auth';
import { homeFor } from '../components/ProtectedRoute';

export function HomePage() {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [ps, setPs] = useState<PlatformStats | null>(null);
  const { authed, role } = useAuth();
  // Only residents report; council and contractors get a button to their own workspace instead
  const staff = authed && role !== 'citizen';
  const primary = staff
    ? { to: homeFor(role), label: role === 'admin' ? 'Open council overview' : 'Open my jobs' }
    : { to: '/report', label: 'Report a defect' };

  useEffect(() => {
    api.listDefects({}).then(d => { setDefects(d); setPs(api.statsFrom(d)); }).catch(() => {});
  }, []);

  const stats = [
    { v: ps ? ps.totalReported.toLocaleString() : '—', k: 'Defects reported', d: 'all time' },
    { v: ps ? ps.inProgress.toLocaleString() : '—', k: 'Being repaired', d: 'assigned or in progress' },
    { v: ps ? ps.totalCompleted.toLocaleString() : '—', k: 'Repairs verified', d: ps ? `${ps.closureRate}% of all reports` : '' },
    { v: ps ? ps.activeResidents.toLocaleString() : '—', k: 'Residents reporting', d: 'people who reported' },
  ];

  const recent = defects.slice(0, 3);

  return (
    <>
      {/* HERO */}
      <section className="hero-grad py-16 md:py-24">
        <div className="w-full max-w-[1280px] mx-auto px-6 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="section-label">Orange City Council</span>
            <h1 className="mt-4 text-[36px] md:text-[48px] font-extrabold tracking-tight leading-[1.05]">
              Spot it. Report it. RoadFix it.<br />
              <span className="text-brand">Improve your community.</span>
            </h1>
            <p className="mt-5 text-[16px] text-ink-2 leading-relaxed max-w-xl">
              Snap a photo, drop a pin. Council reviews it, assigns a contractor, and you can
              follow every step of the repair. Free for residents.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to={primary.to} className="btn btn-primary btn-lg hover:no-underline">
                {!staff && <IconPlus size={18} />} {primary.label}
              </Link>
              <Link to="/defects" className="btn btn-secondary btn-lg hover:no-underline">
                <IconMap size={18} /> Browse the map
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-6 text-[13px] text-muted">
              <span className="flex items-center gap-1.5"><IconShield size={14} className="text-em-600" /> Repairs verified by council</span>
              <span className="flex items-center gap-1.5"><IconCheckCircle size={14} className="text-em-600" /> Free for residents</span>
            </div>
          </div>
          <div className="card p-2">
            <DefectMap defects={defects.slice(0, 12)} height={420} legend />
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="w-full max-w-[1280px] mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(s => <StatCard key={s.k} k={s.k} v={s.v} d={s.d} />)}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="w-full max-w-[1280px] mx-auto px-6 py-8">
        <div className="text-center mb-10">
          <span className="section-label">How it works</span>
          <h2 className="mt-2 text-3xl">Three steps, and you're done.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { i: IconCamera, t: 'Snap and pin', d: 'Take a photo, drop a pin, add a sentence. Location and details get to council instantly.', c: 'var(--brand-text)' },
            { i: IconCrosshair, t: 'Triaged fast', d: 'Council reviews the report and assigns it to a contractor, who accepts the job.', c: '#7C3AED' },
            { i: IconCheckCircle, t: 'Repair verified', d: 'Follow progress updates on the timeline. Council checks the work before the job is closed.', c: '#059669' },
          ].map((s, i) => (
            <div key={i} className="card p-6">
              <div className="w-11 h-11 rounded-xl grid place-items-center mb-4" style={{ background: `color-mix(in srgb, ${s.c} 16%, transparent)`, color: s.c }}>
                <s.i size={22} />
              </div>
              <h3 className="text-lg mb-2">{s.t}</h3>
              <p className="text-[13.5px] text-muted leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RECENT */}
      {recent.length > 0 && (
        <section className="w-full max-w-[1280px] mx-auto px-6 py-14">
          <div className="flex items-end justify-between mb-6">
            <div>
              <span className="section-label">Latest reports</span>
              <h2 className="mt-2">Recently reported</h2>
            </div>
            <Link to="/defects" className="btn btn-ghost hover:no-underline">See all <IconArrow size={14} /></Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recent.map(d => <DefectCard key={d.id} d={d} />)}
          </div>
        </section>
      )}

      {/* CTA — residents only */}
      {!staff && (
        <section className="w-full max-w-[1280px] mx-auto px-6 pb-16">
          <div className="card p-10 md:p-14 hero-grad text-center">
            <BrandLogo className="h-12 md:h-14 mx-auto mb-8" />
            <h2 className="text-3xl md:text-4xl mb-3">See a hazard? Report it now.</h2>
            <p className="text-ink-2 max-w-xl mx-auto mb-6">Takes about a minute. Council sees it straight away.</p>
            <Link to={primary.to} className="btn btn-primary btn-lg hover:no-underline">
              {!staff && <IconPlus size={18} />} {primary.label}
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
