import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { DefectMap } from '../components/DefectMap';
import { StatCard } from '../components/StatCard';
import { SeverityChip } from '../components/Severity';
import { IconChart, IconUsers, IconAlert, IconClock, IconDownload } from '../lib/icons';
import { STATUS, SEVERITY } from '../lib/constants';
import { errorMessage, relativeTime } from '../lib/utils';
import { useUI } from '../store/ui';
import { useAuth } from '../store/auth';
import { slaStatus, dueDate, DEFAULT_FIX_DAYS } from '../lib/sla';
import { byPriority, priorityOf } from '../lib/priority';
import { SlaChip } from '../components/SlaChip';
import type { Defect, Contractor, DefectStatus, Severity as Sev } from '../lib/types';
import { useSeo } from '../lib/seo';

export function AdminPage() {
  useSeo({ title: 'Council overview', noindex: true });
  const { toast, openModal, closeModal } = useUI();
  const userId = useAuth(st => st.userId);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const load = () => api.listDefects({}).then(setDefects).catch(() => toast('error', "Couldn't load reports", 'Check your connection, then refresh the page.'));
  useEffect(() => {
    void load();
    api.listContractors().then(setContractors).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const total = defects.length;
  const byStatus: Record<DefectStatus, number> = { pending: 0, assigned: 0, progress: 0, completed: 0, rejected: 0 };
  const bySeverity: Record<Sev, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const d of defects) { byStatus[d.status]++; bySeverity[d.severity]++; }

  const pending = defects.filter(d => d.status === 'pending').sort(byPriority);
  const notFixed = defects.filter(d => priorityOf(d).reasons.includes('resident says not fixed'));
  const chosen = pending.filter(d => picked.has(d.id));
  const toggle = (id: string) => setPicked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  /** Runs one action over every chosen report, then says how many worked. */
  async function bulk(label: string, fn: (d: Defect) => Promise<void>) {
    let ok = 0;
    const failed: string[] = [];
    for (const d of chosen) {
      try { await fn(d); ok++; }
      catch (err) { failed.push(`${d.id}: ${errorMessage(err, 'failed')}`); }
    }
    closeModal();
    setPicked(new Set());
    await load();
    if (failed.length) toast('error', `${label}: ${ok} done, ${failed.length} failed`, failed.slice(0, 3).join(' · '));
    else toast('success', `${label}: ${ok} report${ok === 1 ? '' : 's'}`, 'Each one is logged on its timeline.');
  }

  function openBulkAssign() {
    openModal(<BulkAssignModal count={chosen.length} contractors={contractors} onCancel={closeModal}
      onAssign={(cId, instructions, days) => bulk('Assigned', async (d) => {
        const n = days ?? DEFAULT_FIX_DAYS[d.severity];
        const due = new Date(Date.now() + n * 86400000);
        await api.assignDefect(d.id, cId, instructions, due.toISOString());
        const who = contractors.find(c => c.id === cId)?.name || cId;
        await api.addUpdate(d.id, {
          action: 'Assigned',
          note: `Assigned to ${who}. Fix within ${n} day${n === 1 ? '' : 's'} (by ${due.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}).\nWork to do: ${instructions}`,
        }, userId!, 'admin');
      })} />);
  }

  function openBulkReject() {
    openModal(<BulkRejectModal count={chosen.length} onCancel={closeModal}
      onReject={(reason) => bulk('Rejected', d => api.rejectDefect(d.id, reason, userId!))} />);
  }
  const toVerify = defects.filter(d => d.status === 'completed' && !d.verified_at);
  const overdue = defects.filter(d => slaStatus(d)?.overdue);
  const dueSoon = defects.filter(d => slaStatus(d)?.soon);
  // Most overdue first, then the ones about to run out
  const urgent = [...overdue, ...dueSoon].sort((a, b) => +dueDate(a) - +dueDate(b));
  const conName = (id: string | null) => (id && contractors.find(c => c.id === id)?.name) || '';

  function exportCsv() {
    if (defects.length === 0) return toast('warning', 'Nothing to export', 'No defects loaded yet.');
    const cols: [string, (d: Defect) => unknown][] = [
      ['ID', d => d.id], ['Title', d => d.title], ['Type', d => d.defect_type], ['Severity', d => d.severity],
      ['Status', d => d.status], ['Address', d => d.road], ['Suburb', d => d.suburb],
      ['Latitude', d => d.latitude], ['Longitude', d => d.longitude], ['Backing', d => d.votes], ['Progress %', d => d.progress],
      ['Reported', d => d.reported_at], ['Contractor', d => conName(d.contractor_id)], ['Work order', d => d.work_instructions],
      ['Fix by', d => dueDate(d).toISOString()], ['Deadline status', d => slaStatus(d)?.label ?? (d.verified_at ? 'Verified' : d.status)],
      ['Verified', d => d.verified_at], ['Reject reason', d => d.reject_reason],
    ];
    const esc = (v: unknown) => {
      let s = v == null ? '' : typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(v);
      // Text typed by the public could start with = + - @ and run as a formula in Excel — neutralise it
      if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.map(c => c[0]).join(','), ...defects.map(d => cols.map(([, get]) => esc(get(d))).join(','))].join('\n');
    // BOM so Excel opens it as UTF-8 (keeps en dashes and accents intact)
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
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
        <StatCard k="Total defects" v={total} d="live in the program" icon={<IconChart size={16} />} color="var(--brand-text)" />
        <StatCard k="Pending triage" v={pending.length} d="new reports" icon={<IconAlert size={16} />} color="#B45309" />
        <StatCard k="Overdue" v={overdue.length} d="past their deadline" icon={<IconClock size={16} />} color="#B91C1C" />
        <StatCard k="Awaiting sign-off" v={toVerify.length} d="repairs to verify" icon={<IconUsers size={16} />} color="#047857" />
      </div>

      {/* Deadlines needing attention */}
      {urgent.length > 0 && (
        <div className="mb-5">
          <ActionList
            title={`Overdue or due within 24 hours`}
            empty=""
            rows={urgent.slice(0, 10).map(d => ({ d, meta: `${d.road}${d.contractor_id ? ` · ${conName(d.contractor_id)}` : ' · not assigned yet'}` }))}
            cta="Open"
            ctaCls="btn-danger"
            tone="danger"
          />
        </div>
      )}

      {notFixed.length > 0 && (
        <div className="mb-5">
          <ActionList
            title="Residents say these aren't fixed"
            empty=""
            rows={notFixed.map(d => ({ d, meta: `${d.road} · verified ${relativeTime(d.verified_at!)}` }))}
            cta="Check"
            ctaCls="btn-danger"
            tone="danger"
          />
        </div>
      )}

      {/* New reports, most urgent first, with bulk actions */}
      <div className="card overflow-hidden mb-5">
        <div className="card-head flex-wrap gap-2">
          <h3 className="flex-1 text-[17px]">New reports to triage <span className="text-[12.5px] font-normal text-muted">· most urgent first</span></h3>
          {chosen.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-sm btn-primary" onClick={openBulkAssign}>Assign {chosen.length}…</button>
              <button className="btn btn-sm btn-danger" onClick={openBulkReject}>Reject {chosen.length}…</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setPicked(new Set())}>Clear</button>
            </div>
          ) : pending.length > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={() => setPicked(new Set(pending.map(d => d.id)))}>Select all {pending.length}</button>
          )}
        </div>
        {pending.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-muted">No new reports waiting.</div>
        ) : (
          <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
            {pending.map(d => {
              const p = priorityOf(d);
              return (
                <div key={d.id} className={`flex items-center gap-3 px-5 py-3 ${picked.has(d.id) ? 'bg-brand-soft' : 'hover:bg-surface-2'}`}>
                  <input type="checkbox" className="w-4 h-4 accent-brand flex-none" checked={picked.has(d.id)} onChange={() => toggle(d.id)}
                         aria-label={`Select ${d.id}`} />
                  <span className="mono text-[12px] font-bold w-9 text-center flex-none" title="Priority score">{p.score}</span>
                  <Link to={`/defect/${d.id}`} className="flex-1 min-w-0 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-ink truncate">{d.title}</span>
                      <SeverityChip level={d.severity} />
                    </div>
                    <div className="text-[12px] text-muted truncate mt-0.5">
                      {d.id} · {d.road} · reported {relativeTime(d.reported_at)}{p.reasons.length ? ` · ${p.reasons.join(', ')}` : ''}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-1 gap-5 mb-8">
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
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5 mb-8 items-start">
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
                          <span className="w-8 h-8 rounded-full bg-brand-soft text-brand grid place-items-center text-xs font-bold">{c.abbr}</span>
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
          <DefectMap defects={defects} height={340} legend={false} />
        </div>
      </div>

    </main>
  );
}

function ActionList({ title, empty, rows, cta, ctaCls, tone }: {
  title: string; empty: string; rows: { d: Defect; meta: string }[]; cta: string; ctaCls: string; tone?: 'danger';
}) {
  return (
    <div className={`card overflow-hidden ${tone === 'danger' ? '!border-rd-600' : ''}`}>
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

function BulkAssignModal({ count, contractors, onAssign, onCancel }: {
  count: number; contractors: Contractor[];
  onAssign: (contractorId: string, instructions: string, days: number | null) => Promise<void> | void; onCancel: () => void;
}) {
  const [selected, setSelected] = useState('');
  const [instructions, setInstructions] = useState('');
  const [days, setDays] = useState('');
  const [busy, setBusy] = useState(false);
  const n = days.trim() ? Math.floor(Number(days)) : null;
  const daysOk = n === null || (Number.isFinite(n) && n >= 1 && n <= 365);
  const ready = !!selected && instructions.trim().length >= 10 && daysOk;
  return (
    <>
      <header className="p-5 pb-0"><h3>Assign {count} report{count === 1 ? '' : 's'}</h3></header>
      <div className="p-4 px-5 pt-3 max-h-[70vh] overflow-y-auto grid gap-4">
        <div className="grid gap-1.5">
          <label className="label" htmlFor="bulk-wo">What needs to be done? <span className="text-rd-600">*</span></label>
          <textarea id="bulk-wo" className="textarea" maxLength={2000} value={instructions} onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Patch each pothole with hot-mix asphalt and upload before/after photos." />
          <span className="text-[11.5px] text-muted">The same work order goes on every report you picked.</span>
        </div>
        <div className="grid gap-1.5">
          <label className="label" htmlFor="bulk-days">Days to fix</label>
          <input id="bulk-days" type="number" min={1} max={365} inputMode="numeric" className="input !w-28" value={days}
                 onChange={(e) => setDays(e.target.value)} placeholder="Standard" />
          <span className={`text-[12px] ${daysOk ? 'text-muted' : 'text-rd-600'}`}>
            {daysOk ? 'Leave empty to use each report\'s standard target for its severity.' : 'Enter a number of days between 1 and 365.'}
          </span>
        </div>
        <div>
          <p className="label mb-2">Contractor <span className="text-rd-600">*</span></p>
          <div className="grid gap-2">
            {contractors.length === 0 && <div className="card p-4 text-[13px] text-muted">No contractors yet.</div>}
            {contractors.map(c => (
              <label key={c.id} className={`card p-3 flex items-center gap-3 cursor-pointer ${selected === c.id ? 'border-brand bg-brand-soft' : ''}`}>
                <input type="radio" name="bulk-con" checked={selected === c.id} onChange={() => setSelected(c.id)} className="accent-brand" />
                <span className="flex-1 text-[13.5px] font-semibold">{c.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <footer className="flex gap-2 justify-end p-4 bg-surface-2 border-t border-border">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={!ready || busy}
                onClick={async () => { if (!ready) return; setBusy(true); await onAssign(selected, instructions.trim(), n); setBusy(false); }}>
          {busy ? 'Assigning…' : `Assign ${count}`}
        </button>
      </footer>
    </>
  );
}

function BulkRejectModal({ count, onReject, onCancel }: { count: number; onReject: (reason: string) => Promise<void> | void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <header className="p-5 pb-0"><h3>Reject {count} report{count === 1 ? '' : 's'}</h3></header>
      <div className="p-4 px-5 pt-3">
        <p className="text-[13.5px] text-muted mb-3">Each reporter sees this reason. For duplicates, open the report and use "Merge as duplicate" instead, so the backing isn't lost.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {['Outside council boundary', 'Not a defect (works underway)', 'Insufficient information', 'Spam or test report'].map(r => (
            <button key={r} onClick={() => setReason(r)} className="chip">{r}</button>
          ))}
        </div>
        <textarea className="textarea" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why…" />
      </div>
      <footer className="flex gap-2 justify-end p-4 bg-surface-2 border-t border-border">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger" disabled={!reason.trim() || busy}
                onClick={async () => { if (!reason.trim()) return; setBusy(true); await onReject(reason.trim()); setBusy(false); }}>{busy ? 'Rejecting…' : `Reject ${count}`}</button>
      </footer>
    </>
  );
}
