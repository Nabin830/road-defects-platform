import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { DefectMap } from '../components/DefectMap';
import { StatusBadge } from '../components/Badge';
import { SeverityChip } from '../components/Severity';
import { Timeline } from '../components/Timeline';
import { PhotoField } from '../components/PhotoField';
import { Photo, PhotoMissing } from '../components/Photo';
import { IconArrow, IconStar, IconWrench, IconCheck, IconAlert, IconLeft, IconMap, IconEye } from '../lib/icons';
import { typeOf, SEVERITY } from '../lib/constants';
import { fmt, errorMessage, directionsUrl, distanceLabel, isNetworkError, metres } from '../lib/utils';
import { readCopy, saveCopy } from '../lib/cache';
import { saveJobStep, useOutbox, isJob, JOB_STEP_LABEL, type JobStep } from '../lib/outbox';
import { slaStatus, dueDate, DEFAULT_FIX_DAYS } from '../lib/sla';
import { SlaChip } from '../components/SlaChip';
import type { Defect, RepairUpdate, Contractor, Severity as Sev } from '../lib/types';
import { useSeo } from '../lib/seo';
import type { PhotoEvidence, PhotoPlace } from '../lib/evidence';
import { PhotoChecks } from '../components/PhotoChecks';

const photoPlace = (d: Defect | null): PhotoPlace | null =>
  d ? { lat: d.latitude, lng: d.longitude, label: d.road, ref: d.id } : null;

export function DefectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { role, userId, authed, profile } = useAuth();
  const { toast, openModal, closeModal } = useUI();

  const [defect, setDefect] = useState<Defect | null>(null);
  const [updates, setUpdates] = useState<RepairUpdate[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [voted, setVoted] = useState(false);
  const [voteBusy, setVoteBusy] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);   // showing the copy saved on this phone
  const [hidden, setHidden] = useState<{ photo_url: string | null; photo_flags: string[]; reason: string | null } | null>(null);
  const outbox = useOutbox(st => st.items);
  useSeo(notFound ? { title: 'Report not found', noindex: true } : defect ? {
    title: `${defect.title} — ${defect.road}`,
    description: `${typeOf(defect.defect_type).label} reported in Orange, NSW on ${fmt(defect.reported_at)}. ${defect.description}`.slice(0, 155),
    image: defect.photo_url ?? undefined,
  } : {});

  useEffect(() => {
    if (!id) return;
    // Ignore replies for a report the user has already navigated away from
    let live = true;
    const keep = <T,>(fn: (v: T) => void) => (v: T) => { if (live) fn(v); };
    setNotFound(false);
    setUpdates([]);
    setSavedAt(null);
    setHidden(null);
    api.getDefect(id, userId)
      .then(keep((d: Defect) => { setDefect(d); saveCopy(`defect:${id}`, d); }))
      .catch((err) => {
        if (!live) return;
        // No signal: use the copy saved the last time this report was opened on this phone
        const copy = readCopy<Defect>(`defect:${id}`);
        if (copy && isNetworkError(err)) { setDefect(copy.data); setSavedAt(copy.at); return; }
        setDefect(null); setNotFound(true);
      });
    api.listUpdates(id)
      .then(keep((u: RepairUpdate[]) => { setUpdates(u); saveCopy(`updates:${id}`, u); }))
      .catch(() => { const copy = readCopy<RepairUpdate[]>(`updates:${id}`); if (copy && live) setUpdates(copy.data); });
    api.listContractors().then(keep(setContractors)).catch(() => {});
    if (userId) {
      api.hasVoted(id, userId).then(keep(setVoted)).catch(() => {});
      api.isFollowing(id, userId).then(keep(setFollowing)).catch(() => {});
    } else {
      setVoted(false);
      setFollowing(false);
    }
    return () => { live = false; };
  }, [id, userId]);

  async function refresh() {
    if (!id) return;
    const [d, us] = await Promise.all([api.getDefect(id, userId).catch(() => null), api.listUpdates(id).catch(() => [])]);
    if (d) { setDefect(d); saveCopy(`defect:${id}`, d); }
    setUpdates(us);
  }

  // The hidden photo, for council and the person who reported it
  const canSeeHidden = role === 'admin' || !!defect?.mine;
  useEffect(() => {
    if (!defect?.photo_hidden_at || !canSeeHidden) { setHidden(null); return; }
    void api.getHiddenPhoto(defect.id).then(setHidden);
  }, [defect?.id, defect?.photo_hidden_at, canSeeHidden]);

  if (notFound) return (
    <main className="w-full max-w-[1280px] mx-auto px-6 py-8">
      <div className="card p-10 text-center">
        <h2 className="mb-2">Report not found</h2>
        <p className="text-muted mb-5">There's no report with the ID <span className="mono">{id}</span>. It may have been mistyped or removed.</p>
        <Link to="/defects" className="btn btn-primary hover:no-underline">See all defects</Link>
      </div>
    </main>
  );
  if (!defect || defect.id !== id) return <main className="w-full max-w-[1280px] mx-auto px-6 py-8"><div className="card p-10 text-center text-muted">Loading…</div></main>;

  const contractor = defect.contractor_id ? contractors.find(c => c.id === defect.contractor_id) : null;
  // Contractors can only act on jobs assigned to their own company
  const myJob = role === 'contractor' && !!profile?.contractor_id && defect.contractor_id === profile.contractor_id;
  // Latest contractor photo once the repair is done — shown against the resident's original photo
  const afterPhoto = defect.status === 'completed'
    ? [...updates].reverse().find(u => u.photo_url && u.actor_role === 'contractor') ?? null
    : null;
  const awaitingResponse = myJob && defect.status === 'assigned' && !defect.accepted_at;
  const awaitingVerification = defect.status === 'completed' && !defect.verified_at;
  const verified = defect.status === 'completed' && !!defect.verified_at;
  // A resident says the verified repair isn't fixed, and council hasn't answered yet
  const reopenOpen = verified && !!defect.reopen_requested_at && new Date(defect.reopen_requested_at) > new Date(defect.verified_at!);
  const canAskReopen = role === 'citizen' && authed && verified && !reopenOpen && (defect.mine || voted)
    && Date.now() - new Date(defect.verified_at!).getTime() < 7 * 86400000;
  // This job's steps saved on this phone, not sent yet
  const waitingSteps = outbox.filter(i => isJob(i) && i.defectId === defect.id && i.userId === userId);
  const offlineNow = !navigator.onLine;

  /** Contractor step with no signal: keep it on the phone, and show the job as if it went through. */
  async function saveStepOffline(step: JobStep, note: string, progress: number | null, photo: PhotoEvidence | null, patch: Partial<Defect>) {
    if (!defect || !userId) return;
    if (photo && (photo.meta.photo_source !== 'camera' || photo.meta.photo_lat == null || !photo.meta.photo_taken_at)) {
      throw new Error('No internet. To save this for later, take the photo with the camera at the site (with GPS on).');
    }
    await saveJobStep({ userId, defectId: defect.id, title: defect.title, step, note, progress, photo: photo?.file ?? null, meta: photo?.meta ?? null });
    const next = { ...defect, ...patch };
    setDefect(next);
    saveCopy(`defect:${defect.id}`, next);
    toast('success', 'Saved on this phone', `${JOB_STEP_LABEL[step]} will be sent when you're back online.`);
  }

  /** Runs a contractor step online; with no signal it's saved for later instead. */
  async function stepOrSave(online: () => Promise<void>, step: JobStep, note: string, progress: number | null,
                            photo: PhotoEvidence | null, patch: Partial<Defect>) {
    if (!navigator.onLine) return saveStepOffline(step, note, progress, photo, patch);
    try { await online(); }
    catch (err) {
      if (!isNetworkError(err)) throw err;
      await saveStepOffline(step, note, progress, photo, patch);
    }
  }
  async function run(fn: () => Promise<void>, errTitle: string) {
    try { await fn(); }
    catch (err) { toast('error', errTitle, errorMessage(err, 'Please try again.')); }
  }

  function acceptJob() {
    return run(async () => {
      if (!defect) return;
      const now = new Date().toISOString();
      let sent = false;
      await stepOrSave(async () => { await api.acceptAssignment(defect.id, userId!); sent = true; }, 'accept', '', 10, null,
        { status: 'progress', accepted_at: now, progress: Math.max(defect.progress, 10) });
      if (!sent) return;
      await refresh();
      toast('success', 'Job accepted', 'It is now in progress.');
    }, 'Could not accept job');
  }

  function changeSeverity(to: Sev) {
    return run(async () => {
      if (!defect || to === defect.severity) return;
      await api.changeSeverity(defect.id, defect.severity, to, userId!);
      await refresh();
      toast('success', 'Severity updated', defect.due_at
        ? `Now ${SEVERITY[to].label}. The fix-by date council set stays the same.`
        : `Now ${SEVERITY[to].label} — target ${SEVERITY[to].sla}.`);
    }, 'Could not change severity');
  }

  function verifyRepair() {
    return run(async () => {
      if (!defect) return;
      await api.verifyDefect(defect.id, userId!);
      await refresh();
      toast('success', 'Repair verified', 'The defect is now closed.');
    }, 'Could not verify repair');
  }

  function openRework() {
    openModal(<ReworkModal onSubmit={(note) => run(async () => {
      if (!defect) return;
      await api.requestRework(defect.id, note, userId!);
      await refresh();
      closeModal();
      toast('info', 'Sent back for rework', 'The contractor will see your note.');
    }, 'Could not send back')} onCancel={closeModal} />);
  }

  function openDecline() {
    openModal(<DeclineModal onSubmit={(reason) => run(async () => {
      if (!defect) return;
      await api.declineAssignment(defect.id, reason, userId!);
      closeModal();
      toast('info', 'Job declined', 'Council has been notified to reassign it.');
      void nav('/contractor');
    }, 'Could not decline job')} onCancel={closeModal} />);
  }

  function markProgress() {
    return run(async () => {
      if (!defect) return;
      const progress = Math.max(defect.progress, 25);
      let sent = false;
      await stepOrSave(async () => {
        await api.updateDefect(defect.id, { status: 'progress', accepted_at: defect.accepted_at || new Date().toISOString() });
        await api.addUpdate(defect.id, { action: 'Work started', note: 'Crew on site.', progress }, userId!, 'contractor');
        sent = true;
      }, 'start', 'Crew on site.', progress, null, { status: 'progress', progress, accepted_at: defect.accepted_at || new Date().toISOString() });
      if (!sent) return;
      await refresh();
      toast('info', 'Marked in progress', 'The update is on the timeline.');
    }, 'Could not update job');
  }

  function markComplete() {
    openModal(<CompleteModal place={photoPlace(defect)} before={defect?.photo_url ?? null} onCancel={closeModal} onSubmit={(note, photo) => run(async () => {
      if (!defect) return;
      let sent = false;
      await stepOrSave(async () => {
        const photo_url = await api.uploadPhoto(photo.file, userId!);
        await api.completeJob(defect.id, note, photo_url, photo.meta, userId!);
        sent = true;
      }, 'complete', note, 100, photo, { status: 'completed', progress: 100 });
      closeModal();
      if (!sent) return;
      await refresh();
      toast('success', 'Marked complete', 'Sent to council for verification.');
    }, 'Could not complete job')} />);
  }

  async function openAssign() {
    // Reload so contractors who signed up since the page opened are listed
    const list = await api.listContractors().catch(() => contractors);
    setContractors(list);
    openModal(
      <AssignModal contractors={list} severity={defect!.severity}
                   initialInstructions={defect!.work_instructions || ''} onPick={(cId, instructions, days) => run(async () => {
        if (!defect) return;
        const due = new Date(Date.now() + days * 86400000);
        await api.assignDefect(defect.id, cId, instructions, due.toISOString());
        const who = list.find(c => c.id === cId)?.name || cId;
        await api.addUpdate(defect.id, {
          action: 'Assigned',
          note: `Assigned to ${who}. Fix within ${days} day${days === 1 ? '' : 's'} (by ${fmtDue(due)}).\nWork to do: ${instructions}`,
        }, userId!, 'admin');
        await refresh();
        closeModal();
        toast('success', 'Contractor assigned', 'Waiting for the contractor to accept.');
      }, 'Could not assign contractor')} onCancel={closeModal} />
    );
  }

  function openReject() {
    openModal(<RejectModal onSubmit={(reason) => run(async () => {
      if (!defect) return;
      await api.rejectDefect(defect.id, reason, userId!);
      await refresh();
      closeModal();
      toast('info', 'Report rejected', 'The reporter can see the reason on this page.');
    }, 'Could not reject report')} onCancel={closeModal} />);
  }

  async function toggleVote() {
    if (!defect) return;
    if (!userId) return toast('warning', 'Sign in required', 'Sign in to back this report.');
    setVoteBusy(true);
    try {
      if (voted) { await api.unvote(defect.id, userId); setVoted(false); }
      else { await api.vote(defect.id, userId); setVoted(true); }
      await refresh();
    } catch (err) {
      toast('error', 'Could not update backing', errorMessage(err, 'Please try again.'));
    } finally { setVoteBusy(false); }
  }

  async function toggleFollow() {
    if (!defect) return;
    if (!userId) return toast('warning', 'Sign in required', 'Sign in to follow this report.');
    setFollowBusy(true);
    try {
      if (following) { await api.unfollow(defect.id, userId); setFollowing(false); toast('info', 'Unfollowed', "You won't get notifications for this report any more."); }
      else { await api.follow(defect.id, userId); setFollowing(true); toast('success', 'Following this defect', 'Updates will appear under the bell icon on this website. No emails are sent.'); }
    } catch (err) {
      toast('error', 'Could not update follow status', errorMessage(err, 'Please try again.'));
    } finally { setFollowBusy(false); }
  }

  function openAddUpdate() {
    openModal(<AddUpdateModal place={photoPlace(defect)} before={defect?.photo_url ?? null} onSubmit={(note, progress, photo) => run(async () => {
      if (!defect) return;
      let sent = false;
      await stepOrSave(async () => {
        const photo_url = await api.uploadPhoto(photo.file, userId!);
        await api.addUpdate(defect.id, { action: 'Progress update', note, progress, photo_url, photo: photo.meta }, userId!, 'contractor');
        sent = true;
      }, 'progress', note, progress, photo, { progress });
      closeModal();
      if (!sent) return;
      await refresh();
      toast('success', 'Update published', 'Progress note added to the timeline.');
    }, 'Could not publish update')} onCancel={closeModal} currentProgress={defect?.progress ?? 0} />);
  }

  /* ── council: photo privacy, duplicates, "not fixed" requests ── */
  function openHidePhoto() {
    openModal(<ReasonModal title="Hide this photo from the public"
      intro="The photo is taken off the public page. Only council and the person who reported it can still see it. Use this for faces, number plates or private property."
      chips={['Face visible', 'Number plate visible', 'Private property', 'Inappropriate content']} cta="Hide photo"
      onCancel={closeModal} onSubmit={(reason) => run(async () => {
        if (!defect) return;
        await api.hidePhoto(defect.id, reason);
        await refresh();
        closeModal();
        toast('success', 'Photo hidden', 'It no longer shows on the public page.');
      }, 'Could not hide photo')} />);
  }

  function showPhotoAgain() {
    return run(async () => {
      if (!defect) return;
      await api.showPhoto(defect.id);
      await refresh();
      toast('success', 'Photo shown again', 'It is back on the public page.');
    }, 'Could not show photo');
  }

  async function openMerge() {
    const all = await api.listDefects({}).catch(() => [] as Defect[]);
    const candidates = all
      .filter(d => d.id !== defect!.id && ['pending', 'assigned', 'progress'].includes(d.status))
      .map(d => ({ d, m: metres(defect!.latitude, defect!.longitude, d.latitude, d.longitude) }))
      .filter(x => x.m <= 500)
      .sort((a, b) => a.m - b.m)
      .slice(0, 8);
    openModal(<MergeModal from={defect!} candidates={candidates} onCancel={closeModal} onPick={(intoId) => run(async () => {
      if (!defect) return;
      await api.mergeDefects(defect.id, intoId);
      closeModal();
      toast('success', `Merged into ${intoId}`, 'Backing and followers were moved there.');
      void nav(`/defect/${intoId}`);
    }, 'Could not merge reports')} />);
  }

  function openAskReopen() {
    openModal(<ReopenModal place={photoPlace(defect)} onCancel={closeModal} onSubmit={(note, photo) => run(async () => {
      if (!defect) return;
      const url = await api.uploadPhoto(photo.file, userId!);
      try { await api.requestReopen(defect.id, note, url, photo.meta); }
      catch (err) { void api.deletePhoto(url); throw err; }
      await refresh();
      closeModal();
      toast('success', 'Sent to council', 'Council will check the repair and reopen it if needed.');
    }, 'Could not send')} />);
  }

  function dismissReopen() {
    openModal(<ReasonModal title="The repair is fine"
      intro="The resident who asked will see this reason on the timeline."
      chips={['Inspected — repair is sound', 'Different defect nearby — please make a new report', 'Normal wear, not a failed repair']} cta="Close request"
      onCancel={closeModal} onSubmit={(note) => run(async () => {
        if (!defect) return;
        await api.dismissReopen(defect.id, note, userId!);
        await refresh();
        closeModal();
        toast('info', 'Request closed', 'The repair stays verified.');
      }, 'Could not close the request')} />);
  }

  return (
    <main className="w-full max-w-[1280px] mx-auto px-6 py-8">
      <button onClick={() => { const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0; void (idx > 0 ? nav(-1) : nav('/defects')); }} className="btn btn-ghost btn-sm mb-4"><IconLeft size={14} /> Back</button>

      {/* Mobile order: summary → actions → map → timeline. Desktop: two columns. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_auto_1fr] gap-6 items-start">
          <div className="card overflow-hidden order-1 lg:order-none lg:col-start-1">
            {defect.photo_url && (
              <Photo src={defect.photo_url} alt={defect.title} loading="eager" {...{ fetchpriority: 'high' }} className="block w-full max-h-[420px] object-cover bg-surface-2 cursor-zoom-in"
                     onClick={() => window.open(defect.photo_url!, '_blank', 'noopener')} />
            )}
            {!defect.photo_url && defect.photo_hidden_at && (hidden?.photo_url ? (
              <div className="relative">
                <Photo src={hidden.photo_url} alt={defect.title} className="block w-full max-h-[420px] object-cover bg-surface-2 opacity-90" />
                <span className="absolute top-3 left-3 text-[12px] font-semibold px-2.5 py-1 rounded-full bg-black/70 text-white flex items-center gap-1.5">
                  <IconEye size={13} /> Hidden from the public{hidden.reason ? ` — ${hidden.reason}` : ''}. Only {role === 'admin' ? 'council and the reporter' : 'you and council'} can see it.
                </span>
              </div>
            ) : (
              <div className="p-4 bg-surface-2 border-b border-border text-[13px] text-muted">Photo hidden by council for privacy.</div>
            ))}
            <div className="p-6">
              {savedAt && (
                <div className="mb-4 p-3 rounded-lg bg-am-50 border border-am-500/25 text-[12.5px] text-am-700">
                  <b>No internet — saved copy from {new Date(savedAt).toLocaleString('en-AU', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })}.</b> It may be out of date.
                </div>
              )}
              {role === 'admin' && (defect.photo_url || hidden?.photo_url) && (
                <div className="mb-4"><PhotoChecks info={defect.photo_url ? defect : { ...defect, photo_flags: hidden?.photo_flags ?? [] }} /></div>
              )}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <StatusBadge status={defect.status} verified={!!defect.verified_at} />
                <SeverityChip level={defect.severity} />
                <span className="text-xs text-muted">· {typeOf(defect.defect_type).label}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted mb-2">
                <span className="mono">{defect.id}</span>
                <span>·</span>
                <span>Reported {fmt(defect.reported_at)}</span>
              </div>
              <h1 className="text-[26px] sm:text-[30px]">{defect.title}</h1>
              {defect.description && <p className="text-[15px] text-ink-2 leading-relaxed mt-3 whitespace-pre-line">{defect.description}</p>}
              {defect.reject_reason && (
                <div className="mt-4 p-3 rounded-lg bg-rd-50 border border-rd-600/25 flex items-start gap-2.5">
                  <span className="text-rd-600 mt-0.5"><IconAlert size={16} /></span>
                  <div>
                    <div className="text-[13px] font-bold text-rd-700 mb-1">Rejected</div>
                    <p className="text-[13px] text-rd-700">{defect.reject_reason}</p>
                    {defect.merged_into && (
                      <Link to={`/defect/${defect.merged_into}`} className="inline-block mt-1.5 text-[13px] font-bold text-rd-700 underline">Open {defect.merged_into}</Link>
                    )}
                  </div>
                </div>
              )}
              {reopenOpen && (
                <div className="mt-4 p-3 rounded-lg bg-rd-50 border border-rd-600/25 flex items-start gap-2.5">
                  <span className="text-rd-600 mt-0.5"><IconAlert size={16} /></span>
                  <div className="text-[13px] text-rd-700">
                    <div className="font-bold mb-0.5">A resident says this isn't fixed</div>
                    {role === 'admin' ? 'Check their photo on the timeline below, then reopen the job or close the request.' : 'Council has been asked to check the repair again.'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {afterPhoto && (
            <div className="card p-6 order-3 lg:order-none lg:col-start-1">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3>Before &amp; after</h3>
                {verified && <span className="text-[12.5px] font-semibold text-emerald-700 flex items-center gap-1"><IconCheck size={14} /> Verified by council</span>}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { tag: 'Before', src: defect.photo_url, when: defect.reported_at, note: 'Reported by a resident' },
                  { tag: 'After', src: afterPhoto.photo_url, when: afterPhoto.created_at, note: afterPhoto.action },
                ].map(p => (
                  <figure key={p.tag} className="m-0">
                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-bg-alt border border-border">
                      {p.src
                        ? <a href={p.src} target="_blank" rel="noreferrer"><Photo src={p.src} alt={`${p.tag}: ${defect.title}`} className="absolute inset-0 w-full h-full object-cover"
                                                                                    fallback={<PhotoMissing className="absolute inset-0" />} /></a>
                        : <div className="absolute inset-0 grid place-items-center text-[13px] text-muted">No photo supplied</div>}
                      <span className={`absolute top-2 left-2 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${p.tag === 'After' ? 'bg-em-600 text-white' : 'bg-ink text-bg'}`}>{p.tag}</span>
                    </div>
                    <figcaption className="text-[12px] text-muted mt-1.5">{p.note} · {fmt(p.when)}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}

          {defect.work_instructions && defect.status !== 'pending' && defect.status !== 'rejected' && (
            <div className="card p-6 order-3 lg:order-none lg:col-start-1 border-brand">
              <h3 className="flex items-center gap-2 mb-3"><IconWrench size={18} /> Work order from council</h3>
              <p className="text-[14.5px] text-ink-2 leading-relaxed whitespace-pre-line">{defect.work_instructions}</p>
            </div>
          )}

          <div className="card p-6 order-3 lg:order-none lg:col-start-1">
            <h3 className="mb-4">Location</h3>
            <DefectMap defects={[defect]} height={320} legend={false} />
            <div className="mt-3 text-[13.5px] text-muted">{withSuburb(defect.road, defect.suburb)}</div>
          </div>

          {updates.length > 0 && (
            <div className="card p-6 order-4 lg:order-none lg:col-start-1">
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
              <Timeline updates={updates} showPhotoChecks={role === 'admin'} />
            </div>
          )}

        {/* Right: actions + details */}
        <aside className="space-y-4 order-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-3">
          {/* Actions per role */}
          <div className="card p-5 space-y-2.5">
            <h4 className="mb-2">Actions</h4>
            {role === 'citizen' && authed && (
              <>
                <button onClick={toggleFollow} disabled={followBusy}
                        className={`btn btn-block ${following ? 'btn-success' : 'btn-primary'}`}>
                  <IconStar size={16} /> {following ? 'Following' : 'Follow updates'}
                </button>
                {defect.mine ? (
                  <p className="text-[13px] text-muted">This is your report. Others can back it to raise its priority.</p>
                ) : defect.status !== 'completed' && defect.status !== 'rejected' && (
                  <button onClick={toggleVote} disabled={voteBusy}
                          className={`btn btn-block ${voted ? 'btn-success' : 'btn-secondary'}`}>
                    {voted ? 'Backed — tap to remove' : 'Back this report'}
                  </button>
                )}
              </>
            )}
            {canAskReopen && (
              <button onClick={openAskReopen} className="btn btn-danger btn-block">Not fixed? Tell council</button>
            )}
            {myJob && defect.status !== 'completed' && (
              <a href={directionsUrl(defect.latitude, defect.longitude)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-block hover:no-underline">
                <IconMap size={16} /> Navigate to the site
              </a>
            )}
            {myJob && waitingSteps.length > 0 && (
              <div className="p-3 rounded-lg bg-am-50 border border-am-500/25 text-[12.5px] text-am-700">
                <b>Saved on this phone, waiting to send:</b>
                <ul className="list-disc pl-5 mt-1">{waitingSteps.map(i => <li key={i.key}>{isJob(i) ? JOB_STEP_LABEL[i.step] : ''}{i.status === 'failed' ? ` — not accepted: ${i.error}` : ''}</li>)}</ul>
              </div>
            )}
            {myJob && offlineNow && (
              <p className="text-[12.5px] text-muted">No internet: accepting, starting, progress photos and completion are saved on this phone and sent later.</p>
            )}
            {awaitingResponse && (
              <>
                <p className="text-[13px] text-muted">Council has assigned this job to you. Accept it or decline so it can be reassigned.</p>
                <button onClick={acceptJob} className="btn btn-success btn-block">
                  <IconCheck size={16} /> Accept job
                </button>
                <button onClick={openDecline} className="btn btn-danger btn-block">Decline job</button>
              </>
            )}
            {myJob && awaitingVerification && (
              <p className="text-[13px] text-muted">Marked complete — waiting for council to verify the repair.</p>
            )}
            {myJob && !awaitingResponse && defect.status !== 'completed' && (
              <>
                {defect.status !== 'progress' && (
                  <button onClick={markProgress} className="btn btn-primary btn-block">
                    <IconWrench size={16} /> Mark in progress
                  </button>
                )}
                {defect.status === 'progress' && (<>
                  <button onClick={markComplete} className="btn btn-success btn-block">
                    <IconCheck size={16} /> Mark complete
                  </button>
                  <button onClick={openAddUpdate} className="btn btn-secondary btn-block">Add progress update</button>
                </>)}
              </>
            )}
            {role === 'contractor' && authed && !myJob && (
              <p className="text-[13px] text-muted">This job isn't assigned to your company.</p>
            )}
            {role === 'admin' && authed && awaitingVerification && (
              <>
                <p className="text-[13px] text-muted">The contractor has marked this repair complete. Check the work, then verify it or send it back.</p>
                <button onClick={verifyRepair} className="btn btn-success btn-block">
                  <IconCheck size={16} /> Verify &amp; close
                </button>
                <button onClick={openRework} className="btn btn-danger btn-block">Send back for rework</button>
              </>
            )}
            {verified && (
              <p className="text-[13px] font-semibold text-emerald-700 flex items-center gap-1.5">
                <IconCheck size={15} /> Verified by council {fmt(defect.verified_at!)} — closed
              </p>
            )}
            {role === 'admin' && authed && reopenOpen && (
              <>
                <button onClick={openRework} className="btn btn-danger btn-block">Reopen for rework</button>
                <button onClick={dismissReopen} className="btn btn-secondary btn-block">Repair is fine — close request</button>
              </>
            )}
            {role === 'admin' && authed && defect.status !== 'completed' && (
              <>
                {defect.status === 'assigned' && !defect.accepted_at && (
                  <p className="text-[13px] text-muted">Waiting for {contractor?.name || 'the contractor'} to accept or decline.</p>
                )}
                <button onClick={openAssign} className="btn btn-primary btn-block">
                  {defect.status === 'rejected' ? 'Reopen & assign contractor' : defect.contractor_id ? 'Reassign contractor' : 'Assign contractor'}
                </button>
                {defect.status !== 'rejected' && (
                  <button onClick={openReject} className="btn btn-danger btn-block">Reject report</button>
                )}
                {defect.status !== 'rejected' && (
                  <button onClick={() => void openMerge()} className="btn btn-secondary btn-block">Merge as duplicate…</button>
                )}
              </>
            )}
            {role === 'admin' && authed && defect.photo_url && (
              <button onClick={openHidePhoto} className="btn btn-ghost btn-block">Hide photo from the public</button>
            )}
            {role === 'admin' && authed && !defect.photo_url && defect.photo_hidden_at && (
              <button onClick={showPhotoAgain} className="btn btn-ghost btn-block">Show photo to the public again</button>
            )}
            {!authed && (
              <>
                <Link to="/login" className="btn btn-primary btn-block hover:no-underline">Sign in to follow</Link>
                <Link to="/register" className="btn btn-secondary btn-block hover:no-underline">Create account</Link>
              </>
            )}
          </div>

          <div className="card p-5">
            <h4 className="mb-3">Details</h4>
            <dl className="grid grid-cols-[110px_1fr] gap-y-2.5 gap-x-4 text-[13.5px]">
              {role === 'admin' && defect.status !== 'completed' && defect.status !== 'rejected' && (<>
                <dt className="text-muted text-[12.5px]">Severity</dt>
                <dd>
                  <select className="select !min-h-0 !py-1 !px-2 !text-[13px] w-auto" value={defect.severity}
                          aria-label="Change severity"
                          onChange={(e) => changeSeverity(e.target.value as Sev)}>
                    {(['low', 'medium', 'high', 'critical'] as const).map(s => <option key={s} value={s}>{SEVERITY[s].label}</option>)}
                  </select>
                </dd>
              </>)}
              {slaStatus(defect) && (<>
                <dt className="text-muted text-[12.5px]">Fix by</dt>
                <dd>
                  <div className="font-semibold">{fmtDue(dueDate(defect))}</div>
                  <SlaChip d={defect} className="!text-[12.5px]" />
                  <div className="text-[11.5px] text-muted">{defect.due_at ? 'Set by council' : `Standard target for ${SEVERITY[defect.severity].label.toLowerCase()} severity`}</div>
                </dd>
              </>)}
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
              {defect.status === 'completed' && (<>
                <dt className="text-muted text-[12.5px]">Verification</dt>
                <dd className="font-semibold">{verified ? 'Verified by council' : 'Awaiting council check'}</dd>
              </>)}
            </dl>
          </div>

          <Link to="/defects" className="btn btn-ghost btn-block hover:no-underline">
            See all defects <IconArrow size={14} />
          </Link>
        </aside>
      </div>
    </main>
  );
}

/** "12 Summer St, Orange" + suburb "Orange" → no repeat of the suburb. */
function withSuburb(road: string, suburb: string | null) {
  return suburb && !road.toLowerCase().includes(suburb.toLowerCase()) ? `${road}, ${suburb}` : road;
}

/* Modals */
function fmtDue(d: Date) {
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function AssignModal({ contractors, severity, initialInstructions, onPick, onCancel }: {
  contractors: Contractor[]; severity: Sev; initialInstructions: string;
  onPick: (id: string, instructions: string, days: number) => Promise<void> | void; onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string>('');
  const [instructions, setInstructions] = useState(initialInstructions);
  const [days, setDays] = useState(String(DEFAULT_FIX_DAYS[severity]));
  const [busy, setBusy] = useState(false);
  const n = Math.floor(Number(days));
  const daysOk = Number.isFinite(n) && n >= 1 && n <= 365;
  const ready = !!selected && instructions.trim().length >= 10 && daysOk;
  return (
    <>
      <header className="p-5 pb-0"><h3>Assign a contractor</h3></header>
      <div className="p-4 px-5 pt-3 max-h-[70vh] overflow-y-auto">
        <div className="grid gap-1.5 mb-4">
          <label className="label" htmlFor="wo-text">What needs to be done? <span className="text-rd-600">*</span></label>
          <textarea id="wo-text" className="textarea" maxLength={2000} value={instructions} onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Cut out and patch the pothole with hot-mix asphalt, about 1 m². Put up traffic control, repaint the lane line after, and upload before/after photos." />
          <span className="text-[11.5px] text-muted">The contractor sees this before accepting the job.</span>
        </div>
        <div className="grid gap-1.5 mb-5">
          <label className="label" htmlFor="wo-days">Days to fix <span className="text-rd-600">*</span></label>
          <div className="flex flex-wrap items-center gap-2">
            <input id="wo-days" type="number" min={1} max={365} inputMode="numeric" className="input !w-24" value={days}
                   onChange={(e) => setDays(e.target.value)} />
            {[1, 3, 5, 7, 10].map(d => (
              <button key={d} type="button" onClick={() => setDays(String(d))}
                      className="chip" aria-pressed={n === d}>{d} day{d === 1 ? '' : 's'}</button>
            ))}
          </div>
          <span className={`text-[12px] ${daysOk ? 'text-muted' : 'text-rd-600'}`}>
            {daysOk ? <>Fix by <b className="text-ink">{fmtDue(new Date(Date.now() + n * 86400000))}</b> · target for {SEVERITY[severity].label.toLowerCase()} severity: {SEVERITY[severity].sla}</>
                    : 'Enter a number of days between 1 and 365.'}
          </span>
        </div>
        <p className="label mb-2">Contractor <span className="text-rd-600">*</span></p>
        <div className="grid gap-2">
          {contractors.length === 0 && (
            <div className="card p-4 text-[13px] text-muted">
              No contractors yet. A contractor appears here as soon as they sign up at <b>/register</b> choosing "I'm a contractor".
            </div>
          )}
          {contractors.map(c => (
            <label key={c.id} className={`card p-3 flex items-center gap-3 cursor-pointer ${selected === c.id ? 'border-brand bg-brand-soft' : ''}`}>
              <input type="radio" name="con" value={c.id} checked={selected === c.id} onChange={() => setSelected(c.id)} className="accent-brand" />
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold">{c.name}</div>
              </div>
              <span className="w-8 h-8 rounded-full bg-brand-soft text-brand grid place-items-center text-xs font-bold">{c.abbr}</span>
            </label>
          ))}
        </div>
      </div>
      <footer className="flex gap-2 justify-end p-4 bg-surface-2 border-t border-border">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={!ready || busy}
                onClick={async () => { if (!ready) return; setBusy(true); await onPick(selected, instructions.trim(), n); setBusy(false); }}
                title={ready ? undefined : 'Write the work to do (at least 10 characters), set the days, and pick a contractor'}>{busy ? 'Assigning…' : 'Assign'}</button>
      </footer>
    </>
  );
}

function AddUpdateModal({ onSubmit, onCancel, currentProgress, place, before }: { onSubmit: (note: string, progress: number, photo: PhotoEvidence) => Promise<void> | void; onCancel: () => void; currentProgress: number; place: PhotoPlace | null; before: string | null }) {
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState(Math.min(currentProgress, 95));
  const [photo, setPhoto] = useState<PhotoEvidence | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <header className="p-5 pb-0"><h3>Add a progress update</h3></header>
      <div className="p-4 px-5 pt-3 space-y-4">
        <div className="grid gap-1.5">
          <label className="label" htmlFor="upd-note">What's happening on site?</label>
          <textarea id="upd-note" className="textarea" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Crew mobilised, excavation started, patch curing overnight…" />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="upd-prog">Progress</label>
            <span className="mono text-sm font-bold">{progress}%</span>
          </div>
          <input id="upd-prog" type="range" min={0} max={95} step={5} value={Math.min(progress, 95)}
                 onChange={(e) => setProgress(Number(e.target.value))} className="w-full accent-brand" />
        </div>
        <BeforePhoto src={before} />
        <PhotoField value={photo} onChange={setPhoto} place={place} label="Take site photo (required)" />
      </div>
      <footer className="flex gap-2 justify-end p-4 bg-surface-2 border-t border-border">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={!note.trim() || !photo || busy} title={photo ? undefined : 'Add a site photo first'}
                onClick={async () => { if (!note.trim() || !photo) return; setBusy(true); await onSubmit(note.trim(), progress, photo); setBusy(false); }}>
          {busy ? 'Publishing…' : 'Publish update'}
        </button>
      </footer>
    </>
  );
}

function RejectModal({ onSubmit, onCancel }: { onSubmit: (reason: string) => Promise<void> | void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <header className="p-5 pb-0"><h3>Reject this report</h3></header>
      <div className="p-4 px-5 pt-3">
        <p className="text-[13.5px] text-muted mb-3">The reporter will see this reason on the report. Common reasons:</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {['Outside council boundary', 'Duplicate of existing report', 'Not a defect (works underway)', 'Insufficient information'].map(r => (
            <button key={r} onClick={() => setReason(r)} className="chip">{r}</button>
          ))}
        </div>
        <textarea className="textarea" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why…" />
      </div>
      <footer className="flex gap-2 justify-end p-4 bg-surface-2 border-t border-border">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger" disabled={!reason.trim() || busy}
                onClick={async () => { if (!reason.trim()) return; setBusy(true); await onSubmit(reason.trim()); setBusy(false); }}>{busy ? 'Saving…' : 'Reject report'}</button>
      </footer>
    </>
  );
}

function DeclineModal({ onSubmit, onCancel }: { onSubmit: (reason: string) => Promise<void> | void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <header className="p-5 pb-0"><h3>Decline this job</h3></header>
      <div className="p-4 px-5 pt-3">
        <p className="text-[13.5px] text-muted mb-3">The job goes back to council to reassign. Let them know why:</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {['No crew available', 'Outside our service area', 'Needs specialist equipment', 'Schedule is full'].map(r => (
            <button key={r} onClick={() => setReason(r)} className="chip">{r}</button>
          ))}
        </div>
        <textarea className="textarea" maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason…" />
      </div>
      <footer className="flex gap-2 justify-end p-4 bg-surface-2 border-t border-border">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger" disabled={!reason.trim() || busy}
                onClick={async () => { if (!reason.trim()) return; setBusy(true); await onSubmit(reason.trim()); setBusy(false); }}>{busy ? 'Saving…' : 'Decline job'}</button>
      </footer>
    </>
  );
}

function ReworkModal({ onSubmit, onCancel }: { onSubmit: (note: string) => Promise<void> | void; onCancel: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <header className="p-5 pb-0"><h3>Send back for rework</h3></header>
      <div className="p-4 px-5 pt-3">
        <p className="text-[13.5px] text-muted mb-3">The job goes back to the contractor as in progress. Tell them what still needs fixing:</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {['Repair incomplete', 'Poor finish quality', 'Site not cleaned up', 'Wrong location repaired'].map(r => (
            <button key={r} onClick={() => setNote(r)} className="chip">{r}</button>
          ))}
        </div>
        <textarea className="textarea" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What needs fixing…" />
      </div>
      <footer className="flex gap-2 justify-end p-4 bg-surface-2 border-t border-border">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger" disabled={!note.trim() || busy}
                onClick={async () => { if (!note.trim()) return; setBusy(true); await onSubmit(note.trim()); setBusy(false); }}>{busy ? 'Saving…' : 'Send back'}</button>
      </footer>
    </>
  );
}

function CompleteModal({ onSubmit, onCancel, place, before }: { onSubmit: (note: string, photo: PhotoEvidence) => Promise<void> | void; onCancel: () => void; place: PhotoPlace | null; before: string | null }) {
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<PhotoEvidence | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <header className="p-5 pb-0"><h3>Mark repair complete</h3></header>
      <div className="p-4 px-5 pt-3 space-y-4">
        <p className="text-[13.5px] text-muted">Council will check the work before closing the job. A photo of the finished repair is required.</p>
        <BeforePhoto src={before} />
        <PhotoField value={photo} onChange={setPhoto} place={place} label="Take photo of the finished repair (required)" />
        <div className="grid gap-1.5">
          <label className="label" htmlFor="done-note">Notes for council (optional)</label>
          <textarea id="done-note" className="textarea !min-h-[80px]" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Hot-mix patch laid and compacted, site swept." />
        </div>
      </div>
      <footer className="flex gap-2 justify-end p-4 bg-surface-2 border-t border-border">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-success" disabled={busy || !photo} title={photo ? undefined : 'Add a photo first'}
                onClick={async () => { if (!photo) return; setBusy(true); await onSubmit(note.trim(), photo); setBusy(false); }}>
          {busy ? 'Submitting…' : 'Mark complete'}
        </button>
      </footer>
    </>
  );
}

/** The resident's original photo, so the crew can take the "after" from the same angle. */
function BeforePhoto({ src }: { src: string | null }) {
  if (!src) return null;
  return (
    <figure className="m-0">
      <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-bg-alt border border-border">
        <Photo src={src} alt="Before: the reported defect" className="absolute inset-0 w-full h-full object-cover"
               fallback={<div className="absolute inset-0 grid place-items-center text-[12.5px] text-muted">Before photo not available offline</div>} />
        <span className="absolute top-2 left-2 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-ink text-bg">Before</span>
      </div>
      <figcaption className="text-[12px] text-muted mt-1">Take your photo from the same spot and angle so council can compare.</figcaption>
    </figure>
  );
}

/** A reason picked from common ones or typed. */
function ReasonModal({ title, intro, chips, cta, onSubmit, onCancel }: {
  title: string; intro: string; chips: string[]; cta: string;
  onSubmit: (reason: string) => Promise<void> | void; onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <header className="p-5 pb-0"><h3>{title}</h3></header>
      <div className="p-4 px-5 pt-3">
        <p className="text-[13.5px] text-muted mb-3">{intro}</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {chips.map(r => <button key={r} onClick={() => setReason(r)} className="chip">{r}</button>)}
        </div>
        <textarea className="textarea" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason…" />
      </div>
      <footer className="flex gap-2 justify-end p-4 bg-surface-2 border-t border-border">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={!reason.trim() || busy}
                onClick={async () => { if (!reason.trim()) return; setBusy(true); await onSubmit(reason.trim()); setBusy(false); }}>{busy ? 'Saving…' : cta}</button>
      </footer>
    </>
  );
}

/** Council picks the original report a duplicate should be merged into. */
function MergeModal({ from, candidates, onPick, onCancel }: {
  from: Defect; candidates: { d: Defect; m: number }[];
  onPick: (intoId: string) => Promise<void> | void; onCancel: () => void;
}) {
  const [selected, setSelected] = useState(candidates[0]?.d.id ?? '');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const target = (typed.trim().toUpperCase() || selected);
  const ok = /^RD-[A-Z0-9]{6,14}$/.test(target) && target !== from.id;
  return (
    <>
      <header className="p-5 pb-0"><h3>Merge {from.id} as a duplicate</h3></header>
      <div className="p-4 px-5 pt-3 max-h-[70vh] overflow-y-auto">
        <p className="text-[13.5px] text-muted mb-3">
          {from.id} will be closed as a duplicate. Its backing and followers (and the person who reported it) move to the report you pick.
        </p>
        <p className="label mb-2">Open reports within 500 m</p>
        <div className="grid gap-2 mb-4">
          {candidates.length === 0 && <div className="card p-3 text-[13px] text-muted">None nearby. Type the report ID below.</div>}
          {candidates.map(({ d, m }) => (
            <label key={d.id} className={`card p-3 flex items-center gap-3 cursor-pointer ${!typed && selected === d.id ? 'border-brand bg-brand-soft' : ''}`}>
              <input type="radio" name="merge" checked={!typed && selected === d.id} onChange={() => { setSelected(d.id); setTyped(''); }} className="accent-brand" />
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold truncate">{d.title}</div>
                <div className="text-[12px] text-muted truncate">{d.id} · {distanceLabel(m)} away · {d.votes} backing · reported {fmt(d.reported_at)}</div>
              </div>
              <SeverityChip level={d.severity} />
            </label>
          ))}
        </div>
        <label className="label" htmlFor="merge-id">Or type a report ID</label>
        <input id="merge-id" className="input mono mt-1.5" placeholder="RD-…" value={typed} onChange={(e) => setTyped(e.target.value)} />
      </div>
      <footer className="flex gap-2 justify-end p-4 bg-surface-2 border-t border-border">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={!ok || busy}
                onClick={async () => { if (!ok) return; setBusy(true); await onPick(target); setBusy(false); }}>{busy ? 'Merging…' : `Merge into ${ok ? target : '…'}`}</button>
      </footer>
    </>
  );
}

/** A resident says a verified repair isn't fixed — what's wrong, plus a photo taken now. */
function ReopenModal({ onSubmit, onCancel, place }: { onSubmit: (note: string, photo: PhotoEvidence) => Promise<void> | void; onCancel: () => void; place: PhotoPlace | null }) {
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<PhotoEvidence | null>(null);
  const [busy, setBusy] = useState(false);
  const ok = note.trim().length >= 10 && !!photo;
  return (
    <>
      <header className="p-5 pb-0"><h3>Not fixed?</h3></header>
      <div className="p-4 px-5 pt-3 space-y-4">
        <p className="text-[13.5px] text-muted">Tell council what's still wrong and take a photo of it now. Council will check the repair and can send the contractor back.</p>
        <div className="flex flex-wrap gap-2">
          {['The pothole has come back', 'The patch is breaking up', 'Only part of it was fixed'].map(r => (
            <button key={r} onClick={() => setNote(r + '. ')} className="chip">{r}</button>
          ))}
        </div>
        <textarea className="textarea" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's wrong with the repair…" />
        <PhotoField value={photo} onChange={setPhoto} place={place} label="Take a photo of the problem (required)" />
      </div>
      <footer className="flex gap-2 justify-end p-4 bg-surface-2 border-t border-border">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger" disabled={!ok || busy} title={ok ? undefined : 'Describe the problem (10+ characters) and add a photo'}
                onClick={async () => { if (!ok || !photo) return; setBusy(true); await onSubmit(note.trim(), photo); setBusy(false); }}>
          {busy ? 'Sending…' : 'Send to council'}
        </button>
      </footer>
    </>
  );
}
