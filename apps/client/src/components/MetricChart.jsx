import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, XAxis, YAxis } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatValue, indexBreaches, METRICS, METRICS_BY_KEY, withUnit } from '../metrics.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { EmptyState } from './states.jsx';

// 'Santiago Molina' -> 'S. Molina' (pantallas angostas)
export const shortName = (name) => { const [first, ...rest] = name.split(' '); return rest.length ? `${first[0]}. ${rest.join(' ')}` : name; };

/**
 * Datos del gráfico (función pura, testeable sin renderizar SVG): jugadores con valor para la métrica,
 * de mayor a menor, con su nivel de alerta. `missing` = jugadores sin dato (p. ej. RPE no reportado).
 */
export function buildChartData(metrics, alerts, metricKey) {
  const metric = METRICS_BY_KEY[metricKey];
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
  return { data, missing: metrics.length - data.length };
}

// Colores por nivel = variables del tema (index.css): sin hex duplicados en el componente.
const LEVEL_FILL = { normal: 'var(--chart-1)', warning: 'var(--chart-2)', critical: 'var(--chart-3)' };

function LevelTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="grid min-w-40 gap-1 rounded-lg border border-border/50 bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-foreground">#{d.shirtNumber} {d.name}</p>
      <p className="text-muted-foreground">
        {metric.label}: <span className="font-mono font-semibold text-foreground tabular-nums">{withUnit(d.value, metric)}</span>
      </p>
      {d.level !== 'normal' && (
        <p className={d.level === 'critical' ? 'text-critical-fg' : 'text-warning-fg'}>
          {d.level === 'critical' ? 'Critical' : 'Warning'} threshold reached
        </p>
      )}
    </div>
  );
}

/**
 * Chart de shadcn/ui (Recharts dentro de ChartContainer): barras horizontales por jugador para la
 * métrica elegida, de mayor a menor, coloreadas según las alertas y con las líneas de umbral.
 */
export default function MetricChart({ metrics, alerts, thresholds }) {
  const [metricKey, setMetricKey] = useState('total_distance_m');
  const compact = useMediaQuery('(max-width: 639px)'); // móvil: eje más angosto y nombres abreviados
  const metric = METRICS_BY_KEY[metricKey];
  const threshold = thresholds?.[metricKey];
  const { data, missing } = buildChartData(metrics, alerts, metricKey);
  const chartConfig = { value: { label: metric.label, color: 'var(--chart-1)' } };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <Label htmlFor="chart-metric" className="text-soft">Metric</Label>
        <Select value={metricKey} onValueChange={setMetricKey}>
          <SelectTrigger id="chart-metric" className="w-full rounded-pill bg-secondary sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METRICS.map((m) => (
              <SelectItem key={m.key} value={m.key}>
                {m.label}{m.unit ? ` (${m.unit})` : ''}
                {thresholds?.[m.key] && <span className="text-warning" aria-label="has threshold">•</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data.length === 0 ? (
        <EmptyState icon={BarChart3} title="No data for this metric" description="None of the players reported a value for this metric in this session." />
      ) : (
        <ChartContainer
          config={chartConfig}
          className="aspect-auto w-full"
          style={{ height: Math.max(220, data.length * (compact ? 28 : 30) + 40) }}
          role="img"
          aria-label={`${metric.label} by player, highest first`}
        >
          <BarChart data={data} layout="vertical" margin={{ top: 16, right: compact ? 36 : 48, bottom: 0, left: compact ? 0 : 8 }} accessibilityLayer>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} tickCount={compact ? 3 : 5} tickFormatter={(v) => formatValue(v, metric)} />
            <YAxis type="category" dataKey="name" width={compact ? 84 : 124} tickFormatter={compact ? shortName : undefined} tickLine={false} axisLine={false} interval={0} tick={{ fill: 'var(--color-soft, #d9e5fa)', fontSize: 12 }} />
            <ChartTooltip cursor={{ fill: 'var(--accent)', opacity: 0.4 }} content={<LevelTooltip metric={metric} />} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.name} fill={LEVEL_FILL[d.level]} />)}
              <LabelList dataKey="value" position="right" formatter={(v) => formatValue(v, metric)} className="fill-foreground" fontSize={11} />
            </Bar>
            {threshold && (
              <ReferenceLine x={threshold.warning} stroke="var(--chart-2)" strokeDasharray="4 4" ifOverflow="extendDomain"
                label={{ value: `Warning ${formatValue(threshold.warning, metric)}`, position: 'top', fontSize: 11, fill: 'var(--chart-2)' }} />
            )}
            {threshold?.critical != null && (
              <ReferenceLine x={threshold.critical} stroke="var(--chart-3)" strokeDasharray="4 4" ifOverflow="extendDomain"
                label={{ value: `Critical ${formatValue(threshold.critical, metric)}`, position: 'top', fontSize: 11, fill: 'var(--chart-3)' }} />
            )}
          </BarChart>
        </ChartContainer>
      )}

      {missing > 0 && data.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {missing} player{missing > 1 ? 's' : ''} not shown: value not reported.
        </p>
      )}
    </div>
  );
}
