import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatValue, indexBreaches, METRICS, METRICS_BY_KEY, withUnit } from '../metrics.js';
import { EmptyState } from './ui.jsx';

const COLORS = { normal: '#6366f1', warning: '#f59e0b', critical: '#ef4444' };

function ChartTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-slate-900">#{d.shirtNumber} {d.name}</p>
      <p className="text-slate-600">{metric.label}: <span className="font-semibold">{withUnit(d.value, metric)}</span></p>
      {d.level !== 'normal' && (
        <p className={d.level === 'critical' ? 'text-red-600' : 'text-amber-600'}>
          {d.level === 'critical' ? '▲▲ Critical' : '▲ Warning'} threshold reached
        </p>
      )}
    </div>
  );
}

/**
 * Barras horizontales por jugador para la métrica elegida, ordenadas de mayor a menor.
 * Colorea según las alertas del servidor y dibuja las líneas de umbral si la métrica tiene.
 */
export default function MetricChart({ metrics, alerts, thresholds }) {
  const [metricKey, setMetricKey] = useState('total_distance_m');
  const metric = METRICS_BY_KEY[metricKey];
  const threshold = thresholds?.[metricKey];
  const breaches = indexBreaches(alerts);

  const data = metrics
    .filter((row) => row[metric.field] !== null)
    .map((row) => ({
      name: row.player.name,
      shirtNumber: row.player.shirtNumber,
      value: row[metric.field],
      level: breaches.get(`${row.playerId}:${metricKey}`)?.level ?? 'normal',
    }))
    .sort((a, b) => b.value - a.value);
  const missing = metrics.length - data.length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="chart-metric" className="text-sm font-medium text-slate-600">Metric</label>
        <select
          id="chart-metric"
          value={metricKey}
          onChange={(e) => setMetricKey(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
        >
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}{m.unit ? ` (${m.unit})` : ''}{thresholds?.[m.key] ? ' •' : ''}
            </option>
          ))}
        </select>
      </div>

      {data.length === 0 ? (
        <EmptyState title="No data for this metric" description="None of the players reported a value for this metric in this session." />
      ) : (
        <div style={{ height: Math.max(220, data.length * 30 + 40) }} role="img" aria-label={`${metric.label} by player, highest first`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 16, right: 48, bottom: 0, left: 8 }}>
              <CartesianGrid horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => formatValue(v, metric)} />
              <YAxis type="category" dataKey="name" width={124} tick={{ fontSize: 12, fill: '#334155' }} interval={0} />
              <Tooltip content={<ChartTooltip metric={metric} />} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
                {data.map((d) => <Cell key={d.name} fill={COLORS[d.level]} />)}
                <LabelList dataKey="value" position="right" formatter={(v) => formatValue(v, metric)} style={{ fontSize: 11, fill: '#475569' }} />
              </Bar>
              {threshold && (
                <ReferenceLine x={threshold.warning} stroke={COLORS.warning} strokeDasharray="4 4" ifOverflow="extendDomain"
                  label={{ value: `Warning ${formatValue(threshold.warning, metric)}`, position: 'top', fontSize: 11, fill: '#b45309' }} />
              )}
              {threshold?.critical != null && (
                <ReferenceLine x={threshold.critical} stroke={COLORS.critical} strokeDasharray="4 4" ifOverflow="extendDomain"
                  label={{ value: `Critical ${formatValue(threshold.critical, metric)}`, position: 'top', fontSize: 11, fill: '#b91c1c' }} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {missing > 0 && data.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {missing} player{missing > 1 ? 's' : ''} not shown: value not reported.
        </p>
      )}
    </div>
  );
}
