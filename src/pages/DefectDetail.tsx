import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { DefectMap } from '../components/DefectMap';
import { StatusBadge } from '../components/Badge';
import { SeverityChip } from '../components/Severity';
import { Timeline } from '../components/Timeline';
import { Placeholder } from '../components/Placeholder';
import { IconArrow, IconStar, IconWrench, IconCheck, IconAlert, IconLeft } from '../lib/icons';
import { typeOf, SEVERITY } from '../lib/constants';
import { fmt } from '../lib/utils';
import type { Defect, RepairUpdate, Contractor } from '../lib/types';

export function DefectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { role, userId, authed } = useAuth();
  const { toast, openModal, closeModal } = useUI();

  const [defect, setDefect] = useState<Defect | null>(null);
  const [updates, setUpdates] = useState<RepairUpdate[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [voted, setVoted] = useState(false);
  const [voteBusy, setVoteBusy] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getDefect(id, userId).then(setDefect).catch(() => setDefect(null));
    api.listUpdates(id).then(setUpdates).catch(() => setUpdates([]));
    api.listContractors().then(setContractors).catch(() => {});
    if (userId) {
      api.hasVoted(id, userId).then(setVoted).catch(() => {});
      api.isFollowing(id, userId).then(setFollowing).catch(() => {});
    } else {
      setVoted(false);
      setFollowing(false);
    }
  }, [id, userId]);

  async function refresh() {
    if (!id) return;
    const [d, us] = await Promise.all([api.getDefect(id, userId).catch(() => null), api.listUpdates(id).catch(() => [])]);
    if (d) setDefect(d);
    setUpdates(us);
  }

  if (!defect) return <main className="w-full max-w-[1280px] mx-auto px-6 py-8"><div className="card p-10 text-center text-muted">Loading…</div></main>;

  const contractor = defect.contractor_id ? contractors.find(c => c.id === defect.contractor_id) : null;

  async function markProgress() {
    if (!defect) return;
    await api.updateDefect(defect.id, { status: 'progress' });
    await api.addUpdate(defect.id, { action: 'Marked in progress', note: 'Crew on site.', progress: 25 }, userId!, 'contractor');
    await refresh();
    toast('info', 'Marked in progress', 'Reporter notified.');
  }

  async function markComplete() {
    if (!defect) return;
    await api.updateDefect(defect.id, { status: 'completed', progress: 100 });
    await api.addUpdate(defect.id, { action: 'Repair complete', note: 'Site cleared. Awaiting inspection.', progress: 100 }, userId!, 'contractor');
    await refresh();
    toast('success', 'Marked complete', 'Awaiting council post-works inspection.');
  }

  function openAssign() {
    openModal(
      <AssignModal contractors={contractors} onPick={async (cId) => {
        if (!defect) return;
        await api.assignDefect(defect.id, cId);
        await api.addUpdate(defect.id, { action: 'Assigned', note: `Assigned to contractor ${contractors.find(c => c.id === cId)?.name || cId}` }, userId!, 'admin');
        await refresh();
        closeModal();
        toast('success', 'Contractor assigned', 'Job pack sent. Reporter notified.');
      }} onCancel={closeModal} />
    );
  }

  function openReject() {
    openModal(<RejectModal onSubmit={async (reason) => {
      if (!defect) return;
      await api.rejectDefect(defect.id, reason, userId!);
      await refresh();
      closeModal();
      toast('error', 'Report rejected', 'The reporter has been emailed the reason.');
    }} onCancel={closeModal} />);
  }

  async function toggleVote() {
    if (!defect) return;
    if (!userId) return toast('warning', 'Sign in required', 'Sign in to back this report.');
    setVoteBusy(true);
    try {
      if (voted) { await api.unvote(defect.id, userId); setVoted(false); }
      else { await api.vote(defect.id, userId); setVoted(true); }
      await refresh();
    } catch (err: any) {
      toast('error', 'Could not update backing', err.message || 'Please try again.');
    } finally { setVoteBusy(false); }
  }

  async function toggleFollow() {
    if (!defect) return;
    if (!userId) return toast('warning', 'Sign in required', 'Sign in to follow this report.');
    setFollowBusy(true);
    try {
      if (following) { await api.unfollow(defect.id, userId); setFollowing(false); toast('info', 'Unfollowed', 'You will no longer see this highlighted.'); }
      else { await api.follow(defect.id, userId); setFollowing(true); toast('success', 'Following this defect', 'It will be pinned in your dashboard as it progresses.'); }
    } catch (err: any) {
      toast('error', 'Could not update follow status', err.message || 'Please try again.');
    } finally { setFollowBusy(false); }
  }

  function openAddUpdate() {
    openModal(<AddUpdateModal onSubmit={async (note, progress) => {
      if (!defect) return;
      await api.addUpdate(defect.id, { action: 'Progress update', note, progress }, userId!, 'contractor');
      await refresh();
      closeModal();
      toast('success', 'Update published', 'Progress note added to the timeline.');
    }} onCancel={closeModal} currentProgress={defect?.progress ?? 0} />);
  }

  return (
    <main className="w-full max-w-[1280px] mx-auto px-6 py-8">
      <button onClick={() => nav(-1)} className="btn btn-ghost btn-sm mb-4"><IconLeft size={14} /> Back</button>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
        {/* Left: image, description, timeline */}
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="relative aspect-[16/9]">
              {defect.photo_url ? (
                <img src={defect.photo_url} alt={defect.title} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <Placeholder label={`${typeOf(defect.defect_type).label} — ${defect.road}`} className="absolute inset-0 !border-0" />
              )}
              <div className="absolute top-3 left-3"><StatusBadge status={defect.status} /></div>
              <div className="absolute top-3 right-3"><SeverityChip level={defect.severity} /></div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 text-xs text-muted mb-2">
                <span className="mono">{defect.id}</span>
                <span>·</span>
                <span>Reported {fmt(defect.reported_at)}</span>
              </div>
              <h1>{defect.title}</h1>
              <p className="text-[15px] text-ink-2 leading-relaxed mt-3">{defect.description}</p>
              {defect.reject_reason && (
                <div className="mt-4 p-3 rounded-lg bg-rd-50 border border-rd-600/25 flex items-start gap-2.5">
                  <span className="text-rd-600 mt-0.5"><IconAlert size={16} /></span>
                  <div>
                    <div className="text-[13px] font-bold text-rd-700 mb-1">Rejected</div>
                    <p className="text-[13px] text-rd-700">{defect.reject_reason}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-4">Location</h3>
            <DefectMap defects={[defect]} height={320} legend={false} />
            <div className="mt-3 text-[13.5px] text-muted">{defect.road}{defect.suburb ? `, ${defect.suburb}` : ''}</div>
          </div>

          {updates.length > 0 && (
            <div className="card p-6">
              <h3 className="mb-5">Repair progress</h3>
              {defect.status !== 'pending' && defect.status !== 'rejected' && (
                <div className="mb-6 p-4 rounded-lg bg-surface-2 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[13px] font-semibold text-ink">Overall progress</div>
                    <div className="mono text-sm font-bold">{defect.progress}%</div>
                  </div>
                  <div className={`prog ${defect.status === 'completed' ? 'em' : ''}`}><i style={{ width: `${defect.progress}%` }} /></div>
                </div>
              )}
              <Timeline updates={updates} />
            </div>
          )}
        </div>

        {/* Right: details + actions */}
        <aside className="space-y-4">
          <div className="card p-5">
            <h4 className="mb-3">Details</h4>
            <dl className="grid grid-cols-[110px_1fr] gap-y-2.5 gap-x-4 text-[13.5px]">
              <dt className="text-muted text-[12.5px]">Type</dt>
              <dd className="font-semibold">{typeOf(defect.defect_type).label}</dd>
              <dt className="text-muted text-[12.5px]">Severity</dt>
              <dd><SeverityChip level={defect.severity} /></dd>
              <dt className="text-muted text-[12.5px]">Status</dt>
              <dd><StatusBadge status={defect.status} /></dd>
              <dt className="text-muted text-[12.5px]">SLA</dt>
              <dd className="font-semibold">{SEVERITY[defect.severity].sla}</dd>
              {defect.depth && (<>
                <dt className="text-muted text-[12.5px]">Depth</dt>
                <dd className="font-semibold">{defect.depth}</dd>
              </>)}
              {defect.width && (<>
                <dt className="text-muted text-[12.5px]">Extent</dt>
                <dd className="font-semibold">{defect.width}</dd>
              </>)}
              <dt className="text-muted text-[12.5px]">Community backing</dt>
              <dd className="font-semibold mono">{defect.votes}</dd>
              {contractor && (<>
                <dt className="text-muted text-[12.5px]">Contractor</dt>
                <dd className="font-semibold">{contractor.name}</dd>
              </>)}
            </dl>
          </div>

          {/* Actions per role */}
          <div className="card p-5 space-y-2.5">
            <h4 className="mb-2">Actions</h4>
            {role === 'citizen' && authed && (
              <>
                <button onClick={toggleFollow} disabled={followBusy}
                        className={`btn btn-block ${following ? 'btn-success' : 'btn-primary'}`}>
                  <IconStar size={16} /> {following ? 'Following' : 'Follow updates'}
                </button>
                <button onClick={toggleVote} disabled={voteBusy}
                        className={`btn btn-block ${voted ? 'btn-success' : 'btn-secondary'}`}>
                  {voted ? 'Backed — tap to remove' : 'Back this report'}
                </button>
              </>
            )}
            {role === 'contractor' && authed && (
              <>
                {defect.status !== 'progress' && defect.status !== 'completed' && (
                  <button onClick={markProgress} className="btn btn-primary btn-block">
                    <IconWrench size={16} /> Mark in progress
                  </button>
                )}
                {defect.status !== 'completed' && (
                  <button onClick={markComplete} className="btn btn-success btn-block">
                    <IconCheck size={16} /> Mark complete
                  </button>
                )}
                <button onClick={openAddUpdate} className="btn btn-secondary btn-block">Add progress update</button>
              </>
            )}
            {role === 'admin' && authed && (
              <>
                <button onClick={openAssign} className="btn btn-primary btn-block">Assign contractor</button>
                <button onClick={openReject} className="btn btn-danger btn-block">Reject report</button>
              </>
            )}
            {!authed && (
              <>
                <Link to="/login" className="btn btn-primary btn-block hover:no-underline">Sign in to follow</Link>
                <Link to="/register" className="btn btn-secondary btn-block hover:no-underline">Create account</Link>
              </>
            )}
          </div>

          <Link to="/defects" className="btn btn-ghost btn-block hover:no-underline">
            See all defects <IconArrow size={14} />
          </Link>
        </aside>
      </div>
    </main>
  );
}

/* Modals */
function AssignModal({ contractors, onPick, onCancel }: { contractors: Contractor[]; onPick: (id: string) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState<string>('');
  return (
    <>
      <header className="p-5 pb-0"><h3>Assign a contractor</h3></header>
      <div className="p-4 px-5 pt-3">
        <p className="text-[13.5px] text-muted mb-3">Pick the crew best suited to this defect.</p>
        <div className="grid gap-2">
          {contractors.map(c => (
            <label key={c.id} className={`card p-3 flex items-center gap-3 cursor-pointer ${selected === c.id ? 'border-brand bg-brand-soft' : ''}`}>
              <input type="radio" name="con" value={c.id} checked={selected === c.id} onChange={() => setSelected(c.id)} className="accent-brand" />
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold">{c.name}</div>
                <div className="text-[11.5px] text-muted mt-0.5">Crew of {c.crew_size} · Rating {c.rating}</div>
              </div>
              <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 grid place-items-center text-xs font-bold">{c.abbr}</span>
            </label>
          ))}
        </div>
      </div>
      <footer className="flex gap-2 justify-end p-4 bg-surface-2 border-t border-border">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={() => selected && onPick(selected)} disabled={!selected}>Assign</button>
      </footer>
    </>
  );
}

function AddUpdateModal({ onSubmit, onCancel, currentProgress }: { onSubmit: (note: string, progress: number) => void; onCancel: () => void; currentProgress: number }) {
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState(currentProgress);
  return (
    <>
      <header className="p-5 pb-0"><h3>Add a progress update</h3></header>
      <div className="p-4 px-5 pt-3 space-y-4">
        <div className="grid gap-1.5">
          <label className="label" htmlFor="upd-note">What's happening on site?</label>
          <textarea id="upd-note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Crew mobilised, excavation started, patch curing overnight…" />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="upd-prog">Progress</label>
            <span className="mono text-sm font-bold">{progress}%</span>
          </div>
          <input id="upd-prog" type="range" min={0} max={100} step={5} value={progress}
                 onChange={(e) => setProgress(Number(e.target.value))} className="w-full accent-brand" />
        </div>
      </div>
      <footer className="flex gap-2 justify-end p-4 bg-surface-2 border-t border-border">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={() => note.trim() && onSubmit(note.trim(), progress)} disabled={!note.trim()}>Publish update</button>
      </footer>
    </>
  );
}

function RejectModal({ onSubmit, onCancel }: { onSubmit: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <>
      <header className="p-5 pb-0"><h3>Reject this report</h3></header>
      <div className="p-4 px-5 pt-3">
        <p className="text-[13.5px] text-muted mb-3">The reporter will be emailed the reason. Common reasons:</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {['Outside council boundary', 'Duplicate of existing report', 'Not a defect (works underway)', 'Insufficient information'].map(r => (
            <button key={r} onClick={() => setReason(r)} className="chip">{r}</button>
          ))}
        </div>
        <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why…" />
      </div>
      <footer className="flex gap-2 justify-end p-4 bg-surface-2 border-t border-border">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger" onClick={() => reason.trim() && onSubmit(reason.trim())} disabled={!reason.trim()}>Reject report</button>
      </footer>
    </>
  );
}
