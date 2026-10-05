import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { SeverityChip } from '../components/Severity';
import { StatusBadge } from '../components/Badge';
import { directionsUrl, distanceLabel, isNetworkError, metres, relativeTime } from '../lib/utils';
import { readCopy, saveCopy } from '../lib/cache';
import { OutboxList } from '../components/Outbox';
import { IconCrosshair, IconMap } from '../lib/icons';
import { SlaChip } from '../components/SlaChip';
import { slaStatus } from '../lib/sla';
import type { Contractor, Defect } from '../lib/types';
import { useSeo } from '../lib/seo';

export function ContractorPage() {
  useSeo({ title: 'My jobs', noindex: true });
  const { profile } = useAuth();
  const [rows, setRows] = useState<Defect[]>([]);
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);   // showing the copy saved on this phone
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const { toast } = useUI();
  const contractorId = profile?.contractor_id || null;

  useEffect(() => {
    if (!contractorId) { setRows([]); setContractor(null); return; }
    setLoading(true);
    setFailed(false);
    api.contractorQueue(contractorId)
      .then(r => { setRows(r); setSavedAt(null); saveCopy(`jobs:${contractorId}`, r); })
      .catch((err) => {
        // No signal: show the jobs as they were last loaded on this phone
        const copy = readCopy<Defect[]>(`jobs:${contractorId}`);
        if (copy && isNetworkError(err)) { setRows(copy.data); setSavedAt(copy.at); return; }
        setFailed(true);
        toast('error', "Couldn't load your jobs", 'Check your connection, then refresh the page.');
      })
      .finally(() => setLoading(false));
    api.listContractors().then(list => setContractor(list.find(c => c.id === contractorId) || null)).catch(() => {});
  }, [contractorId, toast]);

  /** Sorts jobs nearest first, from where the crew is now. */
  function nearestFirst() {
    if (here) { setHere(null); return; }
    if (!('geolocation' in navigator)) return toast('error', 'Location unavailable', 'This device has no location service.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      p => { setHere({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
      () => { setLocating(false); toast('error', 'Could not get your location', 'Allow location for this site, then try again.'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }
  const away = (r: Defect) => (here ? metres(here.lat, here.lng, r.latitude, r.longitude) : null);
  const sortRows = (list: Defect[]) => (here ? [...list].sort((a, b) => away(a)! - away(b)!) : list);

  const assigned = sortRows(rows.filter(r => r.status === 'assigned'));
  const progress = sortRows(rows.filter(r => r.status === 'progress'));
  const done     = rows.filter(r => r.status === 'completed');
  const needsResponse = assigned.filter(r => !r.accepted_at).length;
  const lateJobs = rows.filter(r => slaStatus(r)?.overdue);
  const soonJobs = rows.filter(r => slaStatus(r)?.soon);

  if (!contractorId) {
    return (
      <main className="w-full max-w-[900px] mx-auto px-6 py-8">
        <div className="card p-10 text-center">
          <h1 className="mb-2">Not linked to a company yet</h1>
          <p className="text-muted">Your account isn't attached to a contractor company. Ask council to set your role to
            Contractor on their People page and choose your company — your assigned jobs will then appear here.</p>
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
          {loading ? 'Loading your jobs…' : failed ? "Couldn't load your jobs. Check your connection and refresh." : assigned.length + progress.length === 0
            ? 'No active jobs right now. New jobs from council will appear here.'
            : `${assigned.length + progress.length} active job${assigned.length + progress.length === 1 ? '' : 's'}`}
          {needsResponse > 0 && <> · <b className="text-am-700">{needsResponse} waiting for your response</b></>}
        </p>
      </div>

      {savedAt && (
        <div className="mb-5 p-3 rounded-card border bg-am-50 border-am-500/25 text-am-700 text-[13px]">
          <b>No internet — showing your jobs as they were at {new Date(savedAt).toLocaleString('en-AU', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })}.</b>{' '}
          You can still open a job and accept it, start it, or add photos; it's sent when you're back online.
        </div>
      )}

      <OutboxList />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button className={`btn btn-sm ${here ? 'btn-primary' : 'btn-secondary'}`} onClick={nearestFirst} disabled={locating}>
          <IconCrosshair size={14} /> {locating ? 'Finding you…' : here ? 'Nearest first (on)' : 'Sort nearest first'}
        </button>
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
        <Column title="Assigned" count={assigned.length} rows={assigned} away={away} />
        <Column title="In progress" count={progress.length} rows={progress} away={away} />
        <Column title="Completed" count={done.length} rows={done} away={away} />
      </div>
    </main>
  );
}

function Column({ title, count, rows, away }: { title: string; count: number; rows: Defect[]; away: (r: Defect) => number | null }) {
  return (
    <div className="bg-bg-alt border border-border rounded-card p-3">
      <header className="flex items-center gap-2 px-1 pb-3">
        <h4 className="flex-1">{title}</h4>
        <span className="mono text-[11px] font-bold px-2 py-0.5 rounded-pill bg-surface border border-border text-muted">{count}</span>
      </header>
      <div className="grid gap-2.5">
        {rows.length === 0 && <div className="p-8 text-center text-[12.5px] text-muted">Nothing here.</div>}
        {rows.map(r => (
          <div key={r.id} className="card card-hover overflow-hidden">
          <Link to={`/defect/${r.id}`} className="p-3.5 hover:no-underline block">
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
          {r.status !== 'completed' && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-t border-border bg-surface-2">
              <span className="text-[12px] text-muted">{away(r) != null ? `${distanceLabel(away(r)!)} away` : r.road}</span>
              <a href={directionsUrl(r.latitude, r.longitude)} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary hover:no-underline">
                <IconMap size={14} /> Navigate
              </a>
            </div>
          )}
          </div>
        ))}
      </div>
    </div>
  );
}
