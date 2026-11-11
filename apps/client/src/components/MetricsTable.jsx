import { formatValue, indexBreaches, METRICS, POSITION_LABELS, withUnit } from '../metrics.js';

const COLUMNS = [
  { key: 'shirt_number', label: '#', align: 'right' },
  { key: 'name', label: 'Player', align: 'left' },
  { key: 'position', label: 'Pos', align: 'left' },
  ...METRICS.map((m) => ({ key: m.key, label: m.short, unit: m.unit, metric: m, align: 'right' })),
];

const CELL_LEVEL = {
  critical: 'bg-red-100 text-red-900 font-semibold',
  warning: 'bg-amber-100 text-amber-900 font-semibold',
};

function SortIcon({ active, order }) {
  if (!active) return <span className="text-slate-300 group-hover:text-slate-400" aria-hidden="true">↕</span>;
  return <span className="text-indigo-600" aria-hidden="true">{order === 'asc' ? '↑' : '↓'}</span>;
}

/**
 * Tabla de métricas. El orden lo resuelve el servidor (?order_by & order):
 * la tabla solo informa de la columna pulsada con onSort(key).
 */
export default function MetricsTable({ metrics, alerts, thresholds, sort, onSort, loading }) {
  const breaches = indexBreaches(alerts);

  return (
    <div className="relative">
      <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              {COLUMNS.map((col) => {
                const active = sort.orderBy === col.key;
                const threshold = thresholds?.[col.key];
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`whitespace-nowrap px-3 py-2 font-semibold ${col.align === 'right' ? 'text-right' : 'text-left'} ${
                      col.key === 'name' ? 'sticky left-0 z-10 bg-white' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      disabled={loading}
                      title={threshold ? `Threshold — warning ≥ ${threshold.warning}${threshold.critical ? `, critical ≥ ${threshold.critical}` : ''}` : undefined}
                      className={`group inline-flex items-center gap-1 uppercase hover:text-slate-900 ${col.align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'text-slate-900' : ''}`}
                    >
                      <span>
                        {col.label}
                        {col.unit && <span className="ml-0.5 normal-case text-slate-400">({col.unit})</span>}
                        {threshold && <span className="ml-0.5 text-amber-500" aria-hidden="true">•</span>}
                      </span>
                      <SortIcon active={active} order={sort.order} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {metrics.map((row) => (
              <tr key={row.playerId} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">{row.player.shirtNumber}</td>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium text-slate-900">
                  {row.player.name}
                </td>
                <td className="px-3 py-2 text-slate-500" title={POSITION_LABELS[row.player.position]}>
                  {row.player.position}
                </td>
                {METRICS.map((m) => {
                  const value = row[m.field];
                  const breach = breaches.get(`${row.playerId}:${m.key}`);
                  const title = breach
                    ? `${breach.level === 'critical' ? 'Critical' : 'Warning'}: ${withUnit(value, m)} (threshold ≥ ${formatValue(
                        breach.level === 'critical' ? breach.critical : breach.warning, m,
                      )})`
                    : value === null
                      ? 'Not reported by the player'
                      : undefined;
                  return (
                    <td key={m.key} className="px-1.5 py-1 text-right tabular-nums">
                      <span
                        title={title}
                        className={`inline-block min-w-14 rounded-md px-1.5 py-1 ${breach ? CELL_LEVEL[breach.level] : value === null ? 'text-slate-400' : ''}`}
                      >
                        {breach && <span className="mr-1 text-[10px]" aria-hidden="true">{breach.level === 'critical' ? '▲▲' : '▲'}</span>}
                        {formatValue(value, m)}
                        {breach && <span className="sr-only"> ({breach.level})</span>}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded bg-amber-100 ring-1 ring-amber-300" /> ▲ Warning threshold reached
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded bg-red-100 ring-1 ring-red-300" /> ▲▲ Critical threshold reached
        </span>
        <span><span className="text-amber-500">•</span> Metric with threshold (hover the header for values)</span>
        <span>— Not reported</span>
      </div>
    </div>
  );
}
