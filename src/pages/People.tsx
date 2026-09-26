import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { fmt, initialsOf, errorMessage } from '../lib/utils';
import { IconSearch, IconPlus, IconUsers, IconTruck, IconCheck, IconX } from '../lib/icons';
import type { Contractor, Defect, Profile, Role } from '../lib/types';
import { useSeo } from '../lib/seo';
import { ROLE_LABEL } from '../lib/constants';

const ROLE_CLS: Record<Role, string> = {
  admin: 'bg-blue-50 text-blue-700 border-blue-600/25',
  contractor: 'bg-pu-50 text-pu-700 border-pu-600/25',
  citizen: 'bg-surface-2 text-ink-2 border-border',
};

export function PeoplePage() {
  useSeo({ title: 'People & contractors', noindex: true });
  const { userId } = useAuth();
  const { toast, openModal, closeModal } = useUI();
  const [tab, setTab] = useState<'people' | 'companies'>('people');
  const [people, setPeople] = useState<Profile[]>([]);
  const [companies, setCompanies] = useState<Contractor[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [p, c, d] = await Promise.all([api.listProfiles(), api.listContractors(), api.listDefects({})]);
      setPeople(p); setCompanies(c); setDefects(d);
    } catch (err) {
      toast('error', 'Could not load people', errorMessage(err, 'Please refresh.'));
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => ({
    all: people.length,
    admin: people.filter(p => p.role === 'admin').length,
    contractor: people.filter(p => p.role === 'contractor').length,
    citizen: people.filter(p => p.role === 'citizen').length,
  }), [people]);

  const shown = people.filter(p => {
    if (roleFilter !== 'all' && p.role !== roleFilter) return false;
    const s = q.trim().toLowerCase();
    return !s || p.name.toLowerCase().includes(s) || p.email.toLowerCase().includes(s);
  });

  const companyName = (id: string | null) => companies.find(c => c.id === id)?.name || '—';

  function confirmRole(p: Profile, role: Role, contractorId: string | null = null) {
    const company = contractorId ? companyName(contractorId) : null;
    const what = role === 'contractor'
      ? `a contractor${company ? ` for ${company}` : ' (a company will be created in their name)'}`
      : role === 'admin' ? 'a council admin' : 'a resident';
    openModal(
      <ConfirmModal
        title="Change role?"
        body={<>Make <b>{p.name}</b> ({p.email}) {what}?{role === 'admin' && <> They will be able to assign, verify and reject every report, and manage people.</>}</>}
        confirm="Change role"
        onCancel={closeModal}
        onConfirm={async () => {
          try {
            await api.setUserRole(p.id, role, contractorId);
            closeModal();
            toast('success', 'Role updated', `${p.name} is now ${ROLE_LABEL[role].toLowerCase()}. They'll see it next time they open the app.`);
            await load();
          } catch (err) {
            closeModal();
            toast('error', 'Could not change role', errorMessage(err, 'Please try again.'));
          }
        }}
      />,
    );
  }

  return (
    <main className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <span className="section-label">Council</span>
        <h1 className="mt-1">People &amp; contractors</h1>
        <p className="text-muted mt-1">Change what each account can do, and manage the contractor companies you assign work to.</p>
      </div>

      <div className="flex gap-1 bg-surface-2 border border-border rounded-btn p-1 w-fit mb-5" role="tablist">
        {([['people', IconUsers, `People (${people.length})`], ['companies', IconTruck, `Companies (${companies.length})`]] as const).map(([v, Ic, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold ${tab === v ? 'bg-surface text-brand shadow-sm' : 'text-muted hover:text-ink'}`}>
            <Ic size={15} /> {l}
          </button>
        ))}
      </div>

      {tab === 'people' ? (
        <section className="card overflow-hidden">
          <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><IconSearch size={15} /></span>
              <input className="input !pl-9" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'admin', 'contractor', 'citizen'] as const).map(r => (
                <button key={r} onClick={() => setRoleFilter(r)} aria-pressed={roleFilter === r} className="chip !h-8">
                  {r === 'all' ? 'Everyone' : ROLE_LABEL[r]} <span className="opacity-70">{counts[r]}</span>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-muted">Loading…</div>
          ) : shown.length === 0 ? (
            <div className="p-10 text-center text-muted">No one matches.</div>
          ) : (
            <ul className="divide-y divide-border">
              {shown.map(p => {
                const me = p.id === userId;
                return (
                  <li key={p.id} className="p-4 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_170px_minmax(0,1fr)_110px] md:items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-full bg-brand-soft text-brand grid place-items-center text-xs font-bold flex-none">{initialsOf(p.name)}</span>
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-ink truncate">
                          {p.name} {me && <span className="ml-1 text-[10.5px] font-bold uppercase tracking-wider text-muted">(you)</span>}
                        </div>
                        <div className="text-[12.5px] text-muted truncate">{p.email}{p.phone ? ` · ${p.phone}` : ''}</div>
                      </div>
                    </div>

                    <div>
                      {me ? (
                        <span className={`badge ${ROLE_CLS[p.role]}`}>{ROLE_LABEL[p.role]}</span>
                      ) : (
                        <select className="select !min-h-[36px] !py-1.5" value={p.role} aria-label={`Role for ${p.name}`}
                                onChange={(e) => confirmRole(p, e.target.value as Role)}>
                          <option value="citizen">Resident</option>
                          <option value="contractor">Contractor</option>
                          <option value="admin">Council</option>
                        </select>
                      )}
                    </div>

                    <div className="min-w-0">
                      {p.role === 'contractor' ? (
                        <select className="select !min-h-[36px] !py-1.5" value={p.contractor_id || ''} aria-label={`Company for ${p.name}`}
                                onChange={(e) => e.target.value && confirmRole(p, 'contractor', e.target.value)}>
                          {!p.contractor_id && <option value="">No company</option>}
                          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : <span className="hidden md:inline text-[13px] text-muted">—</span>}
                    </div>

                    <div className="text-[12.5px] text-muted md:text-right">Joined {fmt(p.created_at)}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <Companies companies={companies} people={people} defects={defects} onChanged={load} />
      )}
    </main>
  );
}

/* ─── Contractor companies ─────────────────────────────────────── */

function Companies({ companies, people, defects, onChanged }: {
  companies: Contractor[]; people: Profile[]; defects: Defect[]; onChanged: () => Promise<void>;
}) {
  const { toast } = useUI();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.createCompany(newName.trim());
      setNewName('');
      toast('success', 'Company added', 'Link contractor accounts to it from the People tab.');
      await onChanged();
    } catch (err) { toast('error', 'Could not add company', errorMessage(err, 'Please try again.')); }
  }

  async function rename(c: Contractor) {
    if (!editName.trim() || editName.trim() === c.name) return setEditing(null);
    try {
      await api.renameCompany(c.id, editName.trim());
      setEditing(null);
      toast('success', 'Company renamed', editName.trim());
      await onChanged();
    } catch (err) { toast('error', 'Could not rename', errorMessage(err, 'Please try again.')); }
  }

  return (
    <section className="card overflow-hidden">
      <form onSubmit={add} className="p-4 border-b border-border flex flex-wrap gap-2">
        <input className="input flex-1 min-w-[220px]" maxLength={80} placeholder="New company name, e.g. Summit Asphalt" value={newName}
               onChange={(e) => setNewName(e.target.value)} aria-label="New company name" />
        <button className="btn btn-primary" disabled={!newName.trim()}><IconPlus size={15} /> Add company</button>
      </form>
      {companies.length === 0 ? (
        <div className="p-10 text-center text-muted">No contractor companies yet. They're created automatically when a contractor signs up, or add one above.</div>
      ) : (
        <ul className="divide-y divide-border">
          {companies.map(c => {
            const accounts = people.filter(p => p.role === 'contractor' && p.contractor_id === c.id);
            const jobs = defects.filter(d => d.contractor_id === c.id);
            const open = jobs.filter(d => d.status === 'assigned' || d.status === 'progress').length;
            const done = jobs.filter(d => d.status === 'completed' && d.verified_at).length;
            return (
              <li key={c.id} className="p-4 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_200px] md:items-center">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-pu-50 text-pu-700 grid place-items-center text-xs font-bold flex-none">{c.abbr}</span>
                  {editing === c.id ? (
                    <div className="flex gap-1.5 flex-1">
                      <input className="input !min-h-[36px] !py-1.5" maxLength={80} value={editName} autoFocus aria-label="Company name"
                             onChange={(e) => setEditName(e.target.value)}
                             onKeyDown={(e) => { if (e.key === 'Enter') void rename(c); if (e.key === 'Escape') setEditing(null); }} />
                      <button className="icon-btn !text-em-600" onClick={() => rename(c)} aria-label="Save name"><IconCheck size={16} /></button>
                      <button className="icon-btn" onClick={() => setEditing(null)} aria-label="Cancel"><IconX size={16} /></button>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-ink truncate">{c.name}</div>
                      <button className="text-[12px] font-semibold text-brand hover:underline" onClick={() => { setEditing(c.id); setEditName(c.name); }}>Rename</button>
                    </div>
                  )}
                </div>
                <div className="text-[12.5px] text-muted min-w-0 truncate">
                  {accounts.length === 0 ? 'No linked accounts' : accounts.map(a => a.name).join(', ')}
                </div>
                <div className="flex gap-4 text-[12.5px] md:justify-end">
                  <span><b className="text-ink">{open}</b> <span className="text-muted">open</span></span>
                  <span><b className="text-ink">{done}</b> <span className="text-muted">verified</span></span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ConfirmModal({ title, body, confirm, onConfirm, onCancel }: {
  title: string; body: React.ReactNode; confirm: string; onConfirm: () => Promise<void>; onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <header className="p-5 pb-0"><h3>{title}</h3></header>
      <p className="p-5 pt-3 text-[14px] text-ink-2">{body}</p>
      <footer className="flex gap-2 justify-end p-4 bg-surface-2 border-t border-border">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}>
          {busy ? 'Saving…' : confirm}
        </button>
      </footer>
    </>
  );
}
