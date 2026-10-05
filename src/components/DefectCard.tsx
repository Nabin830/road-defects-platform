import { Link } from 'react-router-dom';
import type { Defect } from '../lib/types';
import { relativeTime } from '../lib/utils';
import { StatusBadge } from './Badge';
import { SeverityChip } from './Severity';
import { MapThumb } from './MapThumb';
import { Photo } from './Photo';
import { SlaChip } from './SlaChip';
import { typeOf } from '../lib/constants';

export function DefectCard({ d }: { d: Defect }) {
  return (
    <Link to={`/defect/${d.id}`} className="card card-hover overflow-hidden group hover:no-underline">
      <div className="relative aspect-video">
        <Photo src={d.photo_url ?? undefined} alt={d.title} className="absolute inset-0 w-full h-full object-cover"
               fallback={<MapThumb lat={d.latitude} lng={d.longitude} severity={d.severity}
                                   label={`${typeOf(d.defect_type).label} — ${d.road}`} className="absolute inset-0 border-b border-border" />} />
        <div className="absolute top-2 right-2"><StatusBadge status={d.status} verified={!!d.verified_at} /></div>
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="mono">{d.id}</span>
          <span>·</span>
          <span>{relativeTime(d.reported_at)}</span>
        </div>
        <h4 className="text-[15px] font-semibold text-ink leading-tight line-clamp-2 group-hover:text-brand">{d.title}</h4>
        <div className="text-[12.5px] text-muted line-clamp-1">{d.road}</div>
        <SlaChip d={d} />
        <div className="flex items-center justify-between pt-1">
          <SeverityChip level={d.severity} />
          <span className="mono text-xs text-muted">{d.votes} backing</span>
        </div>
        {d.progress > 0 && d.status !== 'completed' && (
          <div className="prog mt-1"><i style={{ width: `${d.progress}%` }} /></div>
        )}
      </div>
    </Link>
  );
}
