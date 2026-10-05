import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { DefectCard } from '../components/DefectCard';
import { IconPlus } from '../lib/icons';
import type { Defect } from '../lib/types';
import { useSeo } from '../lib/seo';
import { OutboxList } from '../components/Outbox';

export function MyReportsPage() {
  useSeo({ title: 'My reports', noindex: true });
  const { userId } = useAuth();
  const [mine, setMine] = useState<Defect[]>([]);
  const [tab, setTab] = useState<'all' | 'active' | 'done'>('all');
  const [loading, setLoading] = useState(true);
  const { toast } = useUI();

  useEffect(() => {
    if (userId) api.myReports(userId).then(setMine)
      .catch(() => { if (navigator.onLine) toast('error', "Couldn't load your reports", 'Check your connection, then refresh the page.'); })
      .finally(() => setLoading(false));
  }, [userId, toast]);

  const isDone = (d: Defect) => d.status === 'completed' && !!d.verified_at;
  const shown = mine.filter(d => tab === 'all' ? true : tab === 'done' ? isDone(d) : (!isDone(d) && d.status !== 'rejected'));

  return (
    <main className="w-full max-w-[1280px] mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <span className="section-label">My reports</span>
          <h1 className="mt-1">Reports you've filed</h1>
          <p className="text-muted mt-1">{loading ? 'Loading…' : `${mine.length} total`}</p>
        </div>
        <Link to="/report" className="btn btn-primary hover:no-underline"><IconPlus size={16} /> New report</Link>
      </div>

      <OutboxList />

      <div className="flex gap-2 mb-5">
        {(['all', 'active', 'done'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
                  className={`chip ${tab === t ? 'bg-brand text-brand-ink border-brand' : ''}`} aria-pressed={tab === t}>
            {t === 'all' ? 'All' : t === 'active' ? 'Active' : 'Completed'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-16 text-center text-muted">Loading your reports…</div>
      ) : shown.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-muted">{mine.length === 0 ? "You haven't submitted any reports yet." : 'No reports in this tab.'}</p>
          {mine.length === 0 && (
            <Link to="/report" className="btn btn-primary mt-4 hover:no-underline"><IconPlus size={16} /> Report your first defect</Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map(d => <DefectCard key={d.id} d={d} />)}
        </div>
      )}
    </main>
  );
}
