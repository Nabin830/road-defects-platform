import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { deleteFromOutbox, retryOutboxItem, syncOutbox, useOutbox, type OutboxItem } from '../lib/outbox';
import { OFFLINE_MAX_AGE_DAYS } from '../lib/evidence';
import { relativeTime } from '../lib/utils';
import { IconAlert, IconClock, IconX } from '../lib/icons';

/** Thin bar under the navbar: offline notice, and reports waiting on this phone. */
export function OfflineBar() {
  const { online, items, sending } = useOutbox();
  const { userId, role } = useAuth();
  const mine = items.filter(i => i.userId === userId);
  const failed = mine.filter(i => i.status === 'failed').length;
  const waiting = mine.length - failed;
  if (online && mine.length === 0) return null;

  let text: React.ReactNode;
  if (!online) {
    text = <>
      <b>You're offline.</b>{' '}
      {role === 'citizen' && userId ? 'You can still report a defect — it is saved on this phone and sent when you are back online.' : 'Showing what was last loaded.'}
      {waiting > 0 && ` ${waiting} report${waiting === 1 ? '' : 's'} waiting to send.`}
    </>;
  } else if (failed > 0) {
    text = <><b>{failed} saved report{failed === 1 ? ' was' : 's were'} not accepted.</b> See why on My reports.</>;
  } else {
    text = sending ? `Sending ${waiting} saved report${waiting === 1 ? '' : 's'}…`
      : `${waiting} saved report${waiting === 1 ? '' : 's'} waiting to send (one a minute).`;
  }

  return (
    <div role="status" className={`w-full text-[12.5px] px-4 py-2 border-b flex items-center justify-center gap-2 text-center ${online && !failed ? 'bg-brand-soft border-border text-ink-2' : 'bg-am-50 border-am-500/25 text-am-700'}`}>
      {online ? <IconClock size={14} className="flex-none" /> : <IconAlert size={14} className="flex-none" />}
      <span>{text}</span>
      {mine.length > 0 && role === 'citizen' && <Link to="/my-reports" className="font-semibold underline whitespace-nowrap">View</Link>}
    </div>
  );
}

/** "Waiting to send" list on My reports. */
export function OutboxList() {
  const { items, online, sending } = useOutbox();
  const { userId } = useAuth();
  const mine = items.filter(i => i.userId === userId);
  if (mine.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3>Saved on this phone</h3>
          <p className="text-[12.5px] text-muted">
            Made with no internet. They are sent automatically when you are online — one a minute — and must be sent
            within {OFFLINE_MAX_AGE_DAYS} days of taking the photo.
          </p>
        </div>
        {online && <button className="btn btn-secondary" disabled={sending} onClick={() => void syncOutbox()}>{sending ? 'Sending…' : 'Send now'}</button>}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mine.map(i => <OutboxCard key={i.key} item={i} />)}
      </div>
    </section>
  );
}

function OutboxCard({ item }: { item: OutboxItem }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const url = URL.createObjectURL(item.photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [item.photo]);

  const failed = item.status === 'failed';
  return (
    <div className={`card overflow-hidden ${failed ? 'border-rd-600/40' : ''}`}>
      {preview && <img src={preview} alt="" className="w-full h-[140px] object-cover bg-black" />}
      <div className="p-4 grid gap-1.5">
        <div className="text-[14px] font-semibold text-ink">{item.input.title}</div>
        <div className="text-[12px] text-muted truncate">{item.input.road}</div>
        <div className="text-[12px] text-muted">Saved {relativeTime(item.savedAt)}</div>
        <div className={`text-[12.5px] font-semibold ${failed ? 'text-rd-700' : 'text-am-700'}`}>
          {failed ? `Not accepted: ${item.error}` : item.error ? `Waiting: ${item.error}` : 'Waiting to send'}
        </div>
        <div className="flex gap-2 mt-1">
          {failed && <button className="btn btn-secondary btn-sm" onClick={() => void retryOutboxItem(item)}>Try again</button>}
          {confirm ? (
            <>
              <button className="btn btn-danger btn-sm" onClick={() => void deleteFromOutbox(item)}>Delete it</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(false)}>Keep</button>
            </>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(true)}>
              <IconX size={13} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
