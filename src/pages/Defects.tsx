import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { DefectMap } from '../components/DefectMap';
import { DefectCard } from '../components/DefectCard';
import { StatusBadge } from '../components/Badge';
import { SeverityChip } from '../components/Severity';
import { IconMap, IconGrid, IconTable, IconSearch, IconFilter } from '../lib/icons';
import { TYPES, SEVERITY } from '../lib/constants';
import type { Defect, DefectStatus, Severity, DefectType } from '../lib/types';
import { Link } from 'react-router-dom';
import { relativeTime } from '../lib/utils';

type View = 'map' | 'grid' | 'table';

export function DefectsPage() {
  const { userId } = useAuth();
  const [defects, setDefects] = useState<Defect[]>([]);
  const [view, setView] = useState<View>('map');
  const [status, setStatus] = useState<DefectStatus | 'all'>('all');
  const [sevSet, setSevSet] = useState<Severity[]>([]);
  const [type, setType] = useState<DefectType | 'all'>('all');
  const [q, setQ] = useState('');

  useEffect(() => { api.listDefects({}, userId).then(setDefects).catch(() => {}); }, [userId]);

  const filtered = useMemo(() => {
    return defects.filter(d => {
      if (status !== 'all' && d.status !== status) return false;
      if (sevSet.length && !sevSet.includes(d.severity)) return false;
      if (type !== 'all' && d.defect_type !== type) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!d.title.toLowerCase().includes(s) && !d.road.toLowerCase().includes(s) && !d.description.toLowerCase().includes(s))
          return false;
      }
      return true;
    });
  }, [defects, status, sevSet, type, q]);

  const toggleSev = (s: Severity) => setSevSet(sevSet.includes(s) ? sevSet.filter(x => x !== s) : [...sevSet, s]);

  return (
    <main className="w-full max-w-[1560px] mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <span className="section-label">Public defect map</span>
          <h1 className="mt-1">All reported defects</h1>
          <p className="text-muted mt-1">{filtered.length} of {defects.length} shown</p>
        </div>
        <div className="flex gap-1 bg-surface-2 border border-border rounded-btn p-1">
          {([['map', IconMap, 'Map'], ['grid', IconGrid, 'Cards'], ['table', IconTable, 'Table']] as const).map(([v, Ic, l]) => (
            <button key={v} onClick={() => setView(v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold ${view === v ? 'bg-surface text-brand shadow-sm' : 'text-muted hover:text-ink'}`}>
              <Ic size={15} /> {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-5">
        {/* Filters */}
        <aside className="card p-4 h-fit sticky top-[70px]">
          <div className="flex items-center gap-2 mb-4">
            <IconFilter size={16} className="text-muted" />
            <h4>Filters</h4>
          </div>

          <div className="grid gap-1.5 mb-4">
            <label className="label" htmlFor="qq">Search</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><IconSearch size={15} /></span>
              <input id="qq" className="input !pl-9" placeholder="Title, road, description…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>

          <div className="mb-4">
            <div className="label mb-2">Status</div>
            <div className="grid gap-1">
              {(['all', 'pending', 'assigned', 'progress', 'completed', 'rejected'] as const).map(s => (
                <button key={s} onClick={() => setStatus(s)}
                        className={`text-left px-2.5 py-1.5 rounded-md text-[13px] font-medium ${status === s ? 'bg-brand-soft text-brand font-semibold' : 'text-ink-2 hover:bg-surface-2'}`}>
                  {s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="label mb-2">Severity</div>
            <div className="grid gap-1.5">
              {(['low', 'medium', 'high', 'critical'] as const).map(s => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={sevSet.includes(s)} onChange={() => toggleSev(s)}
                         className="w-4 h-4 accent-brand" />
                  <i className="w-2.5 h-2.5 rounded-full block" style={{ background: SEVERITY[s].color }} />
                  <span className="text-[13px] font-medium">{SEVERITY[s].label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="label mb-2">Type</div>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as DefectType | 'all')}>
              <option value="all">All types</option>
              {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <button className="btn btn-ghost btn-sm mt-4 w-full"
                  onClick={() => { setStatus('all'); setSevSet([]); setType('all'); setQ(''); }}>
            Clear filters
          </button>
        </aside>

        {/* Views */}
        <div className="min-h-0">
          {view === 'map' && <DefectMap defects={filtered} height={620} />}
          {view === 'grid' && (
            filtered.length === 0
              ? <div className="card p-16 text-center text-muted">No defects match these filters.</div>
              : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map(d => <DefectCard key={d.id} d={d} />)}
                </div>
          )}
          {view === 'table' && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border">
                      {['ID', 'Title', 'Road', 'Type', 'Severity', 'Status', 'Reported'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-muted whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(d => (
                      <tr key={d.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                        <td className="px-4 py-3 mono text-xs text-muted">
                          <Link to={`/defect/${d.id}`} className="hover:no-underline">{d.id}</Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/defect/${d.id}`} className="text-ink font-semibold hover:text-brand hover:no-underline">{d.title}</Link>
                        </td>
                        <td className="px-4 py-3 text-ink-2">{d.road}</td>
                        <td className="px-4 py-3 text-ink-2">{TYPES.find(t => t.id === d.defect_type)?.label || d.defect_type}</td>
                        <td className="px-4 py-3"><SeverityChip level={d.severity} /></td>
                        <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                        <td className="px-4 py-3 text-muted">{relativeTime(d.reported_at)}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} className="p-10 text-center text-muted">No defects match these filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
