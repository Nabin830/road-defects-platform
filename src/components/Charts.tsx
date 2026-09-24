import { useEffect, useRef, useState } from 'react';

/* Small dependency-free SVG charts for the council reports.
   Colours come from --series-* tokens (validated for colour-blind separation in
   light and dark); text always uses ink/muted tokens, never the series colour. */

export interface Series { key: string; label: string; color: string; values: (number | null)[]; }

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Round the axis maximum up to a clean number and return evenly spaced ticks. */
function niceTicks(max: number, integer: boolean, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = integer ? Math.max(1, max / count) : max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).filter(s => !integer || Number.isInteger(s)).find(s => s >= raw) || Math.ceil(raw);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/** Column with a 4px rounded data-end and a square baseline. */
function columnPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
      {series.map(s => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-[3px] block" style={{ background: s.color }} /> {s.label}
        </span>
      ))}
    </div>
  );
}

/** Grouped column chart (1–3 series) with a per-column hover/focus tooltip and a table view. */
export function ColumnChart({ categories, series, height = 240, format = (n) => n.toLocaleString(), title, empty = 'No data in this period.' }: {
  categories: string[]; series: Series[]; height?: number; format?: (n: number) => string; title: string; empty?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const pad = { top: 12, right: 8, bottom: 28, left: 40 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(0, ...series.flatMap(s => s.values.map(v => v ?? 0)));
  const integer = series.every(s => s.values.every(v => v == null || Number.isInteger(v)));
  const ticks = niceTicks(max, integer);
  const top = ticks[ticks.length - 1] || 1;
  const band = categories.length ? plotW / categories.length : 0;
  const barW = Math.max(4, Math.min(24, (band * 0.7 - (series.length - 1) * 2) / series.length));
  const groupW = barW * series.length + (series.length - 1) * 2;
  const y = (v: number) => pad.top + plotH - (v / top) * plotH;
  // Thin out x labels when columns get narrow
  const every = band < 34 ? Math.ceil(34 / Math.max(band, 1)) : 1;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <Legend series={series} />
        <button className="text-[12px] font-semibold text-brand hover:underline ml-auto" onClick={() => setAsTable(!asTable)}>
          {asTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>

      {asTable ? (
        <DataTable title={title} categories={categories} series={series} format={format} />
      ) : series.every(s => s.values.every(v => v == null)) ? (
        <div className="grid place-items-center text-[13px] text-muted border border-dashed border-border rounded-lg" style={{ height }}>
          {empty}
        </div>
      ) : (
        <div ref={ref} className="relative" style={{ height }} onPointerLeave={() => setActive(null)}>
          {width > 0 && (
            <svg width={width} height={height} role="img" aria-label={title} className="block overflow-visible">
              {ticks.map(t => (
                <g key={t}>
                  <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
                  <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--muted)] mono" fontSize={11}>{format(t)}</text>
                </g>
              ))}
              {categories.map((c, i) => {
                const x0 = pad.left + i * band;
                const gx = x0 + (band - groupW) / 2;
                return (
                  <g key={c}>
                    {active === i && <rect x={x0 + 2} y={pad.top} width={band - 4} height={plotH} rx={6} fill="var(--surface-2)" />}
                    {series.map((s, si) => {
                      const v = s.values[i] ?? 0;
                      return <path key={s.key} d={columnPath(gx + si * (barW + 2), y(v), barW, y(0) - y(v))} fill={s.color} />;
                    })}
                    {i % every === 0 && (
                      <text x={x0 + band / 2} y={height - 8} textAnchor="middle" className="fill-[var(--muted)]" fontSize={11}>{c}</text>
                    )}
                    {/* Hit target: the whole band, bigger than the columns */}
                    <rect x={x0} y={pad.top} width={band} height={plotH} fill="transparent" tabIndex={0}
                          aria-label={`${c}: ${series.map(s => `${s.label} ${s.values[i] == null ? 'no data' : format(s.values[i]!)}`).join(', ')}`}
                          onPointerEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                          style={{ outline: 'none' }} />
                  </g>
                );
              })}
            </svg>
          )}
          {active != null && width > 0 && (
            <div className="absolute z-10 pointer-events-none popover !animate-none px-3 py-2 min-w-[140px]"
                 style={{
                   left: Math.min(Math.max(pad.left + active * band + band / 2 - 70, 0), width - 150),
                   top: 0,
                 }}>
              <div className="text-[11.5px] font-semibold text-muted mb-1">{categories[active]}</div>
              {series.map(s => (
                <div key={s.key} className="flex items-center gap-2 text-[12.5px]">
                  <i className="w-3 h-[2px] block rounded" style={{ background: s.color }} />
                  <b className="text-ink mono">{s.values[active] == null ? '—' : format(s.values[active]!)}</b>
                  <span className="text-muted">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars for one measure across categories; value sits at the bar tip. */
export function BarList({ rows, color, format = (n) => n.toLocaleString(), empty = 'No data yet.' }: {
  rows: { label: string; value: number }[]; color: string; format?: (n: number) => string; empty?: string;
}) {
  const max = Math.max(1, ...rows.map(r => r.value));
  if (rows.length === 0) return <div className="py-8 text-center text-[13px] text-muted">{empty}</div>;
  return (
    <ul className="grid gap-2.5">
      {rows.map(r => (
        <li key={r.label} className="grid grid-cols-[minmax(90px,140px)_1fr] items-center gap-3 text-[13px]"
            title={`${r.label}: ${format(r.value)}`}>
          <span className="text-ink-2 truncate">{r.label}</span>
          <span className="flex items-center gap-2 min-w-0">
            <span className="h-3.5 rounded-r-[4px]" style={{ width: `${(r.value / max) * 85}%`, minWidth: r.value ? 4 : 0, background: color }} />
            <span className="mono text-[12px] font-semibold text-ink">{format(r.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function DataTable({ title, categories, series, format }: { title: string; categories: string[]; series: Series[]; format: (n: number) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <caption className="sr">{title}</caption>
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-3 text-[11px] font-bold uppercase tracking-widest text-muted">Month</th>
            {series.map(s => <th key={s.key} className="text-right py-2 px-3 text-[11px] font-bold uppercase tracking-widest text-muted">{s.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {categories.map((c, i) => (
            <tr key={c} className="border-b border-border last:border-0">
              <td className="py-2 pr-3 text-ink-2">{c}</td>
              {series.map(s => <td key={s.key} className="py-2 px-3 text-right mono">{s.values[i] == null ? '—' : format(s.values[i]!)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
