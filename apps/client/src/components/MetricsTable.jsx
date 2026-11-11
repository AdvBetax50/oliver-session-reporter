import { useMemo } from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowDown, ArrowDownWideNarrow, ArrowUp, ArrowUpDown, ArrowUpNarrowWide, OctagonAlert, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatValue, indexBreaches, METRICS, POSITION_LABELS, withUnit } from '../metrics.js';

const LEVEL_CELL = {
  critical: 'bg-critical/20 text-critical-fg ring-critical/40',
  warning: 'bg-warning/15 text-warning-fg ring-warning/40',
};
const LEVEL_ICON = { critical: OctagonAlert, warning: TriangleAlert };

// Opciones de orden (las mismas columnas que la tabla), usadas por el selector móvil.
const SORT_OPTIONS = [
  { key: 'shirt_number', label: 'Shirt number' },
  { key: 'name', label: 'Player name' },
  { key: 'position', label: 'Position' },
  ...METRICS.map((m) => ({ key: m.key, label: m.label })),
];

function SortHeader({ label, unit, active, order, hasThreshold, threshold, align, onClick, disabled }) {
  const Icon = !active ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown;
  const button = (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-auto min-h-8 gap-1 px-1.5 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-accent',
        active ? 'text-foreground' : 'text-muted-foreground',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      {/* Unidad debajo del nombre: columnas más angostas para que entren las 11 en escritorio */}
      <span className={cn('flex flex-col leading-tight', align === 'right' ? 'items-end' : 'items-start')}>
        <span>
          {label}
          {hasThreshold && <span className="ml-0.5 text-warning" aria-hidden="true">•</span>}
        </span>
        {unit && <span className="text-[10px] font-normal normal-case text-muted-foreground/80">{unit}</span>}
      </span>
      <Icon className={cn('size-3.5', active ? 'text-primary' : 'opacity-50')} aria-hidden="true" />
    </Button>
  );
  if (!threshold) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>
        Threshold — warning ≥ {threshold.warning}
        {threshold.critical ? `, critical ≥ ${threshold.critical}` : ''}
      </TooltipContent>
    </Tooltip>
  );
}

function MetricCell({ value, metric, breach }) {
  const text = formatValue(value, metric);
  if (value === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help px-2 text-muted-foreground" tabIndex={0}>{text}</span>
        </TooltipTrigger>
        <TooltipContent>Not reported by the player</TooltipContent>
      </Tooltip>
    );
  }
  if (!breach) return <span className="px-2 text-soft">{text}</span>;

  const Icon = LEVEL_ICON[breach.level];
  const limit = breach.level === 'critical' ? breach.critical : breach.warning;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn('inline-flex cursor-help items-center gap-1 rounded-md px-2 py-1 font-semibold ring-1 ring-inset', LEVEL_CELL[breach.level])}>
          <Icon className="size-3" aria-hidden="true" />
          {text}
          <span className="sr-only"> ({breach.level})</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {breach.level === 'critical' ? 'Critical' : 'Warning'}: {withUnit(value, metric)} (threshold ≥ {formatValue(limit, metric)})
      </TooltipContent>
    </Tooltip>
  );
}

// ── Escritorio (≥ lg): data table ─────────────────────────────────────────────────
function DesktopTable({ metrics, breaches, thresholds, sort, onSort, loading }) {
  const columns = useMemo(
    () => [
      { id: 'shirt_number', header: '#', align: 'right', accessorFn: (r) => r.player.shirtNumber,
        cell: ({ getValue }) => <span className="px-2 text-muted-foreground">{getValue()}</span> },
      { id: 'name', header: 'Player', align: 'left', sticky: true, accessorFn: (r) => r.player.name,
        cell: ({ getValue }) => <span className="px-2 font-medium text-foreground">{getValue()}</span> },
      { id: 'position', header: 'Pos', align: 'left', accessorFn: (r) => r.player.position,
        cell: ({ getValue }) => <span className="px-2 text-muted-foreground" title={POSITION_LABELS[getValue()]}>{getValue()}</span> },
      ...METRICS.map((m) => ({
        id: m.key,
        header: m.short,
        unit: m.unit,
        align: 'right',
        accessorFn: (r) => r[m.field],
        cell: ({ row, getValue }) => (
          <MetricCell value={getValue()} metric={m} breach={breaches.get(`${row.original.playerId}:${m.key}`)} />
        ),
      })),
    ],
    [breaches],
  );

  const table = useReactTable({
    data: metrics,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.playerId),
    manualSorting: true, // el orden lo resuelve el servidor (?order_by & order)
    state: { sorting: [{ id: sort.orderBy, desc: sort.order === 'desc' }] },
  });

  return (
    <div className={cn('rounded-xl border transition-opacity', loading && 'opacity-50')} aria-busy={loading}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const def = header.column.columnDef;
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={cn('px-1', def.align === 'right' ? 'text-right' : 'text-left', def.sticky && 'sticky left-0 z-10 bg-card')}
                  >
                    <SortHeader
                      label={def.header}
                      unit={def.unit}
                      align={def.align}
                      active={Boolean(sorted)}
                      order={sorted || undefined}
                      hasThreshold={Boolean(thresholds?.[header.column.id])}
                      threshold={thresholds?.[header.column.id]}
                      onClick={() => onSort(header.column.id)}
                      disabled={loading}
                    />
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="hover:bg-primary/10">
              {row.getVisibleCells().map((cell) => {
                const def = cell.column.columnDef;
                return (
                  <TableCell
                    key={cell.id}
                    className={cn('px-1 py-1.5 tabular-nums', def.align === 'right' ? 'text-right' : 'text-left', def.sticky && 'sticky left-0 z-10 bg-card')}
                  >
                    {flexRender(def.cell, cell.getContext())}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Móvil y tablet (< lg): selector de orden + tarjetas por jugador (2 columnas en tablet) ─────────────────────────────────
function MobileSortBar({ sort, onSort, loading }) {
  const OrderIcon = sort.order === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow;
  return (
    <div className="mb-3 flex items-end gap-2 md:max-w-md">
      <div className="grid flex-1 gap-1.5">
        <Label htmlFor="mobile-sort" className="text-xs text-muted-foreground">Sort by</Label>
        <Select value={sort.orderBy} onValueChange={(key) => key !== sort.orderBy && onSort(key)} disabled={loading}>
          <SelectTrigger id="mobile-sort" className="w-full rounded-pill bg-secondary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {SORT_OPTIONS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onSort(sort.orderBy)} // misma columna -> invierte el sentido
        disabled={loading}
        className="rounded-full bg-secondary"
        aria-label={`Order: ${sort.order === 'asc' ? 'ascending' : 'descending'}. Tap to reverse`}
      >
        <OrderIcon aria-hidden="true" />
      </Button>
    </div>
  );
}

function MobileMetric({ metric, value, breach }) {
  const Icon = breach && LEVEL_ICON[breach.level];
  const limit = breach && (breach.level === 'critical' ? breach.critical : breach.warning);
  return (
    <div className={cn('rounded-lg px-2.5 py-1.5', breach ? cn('ring-1 ring-inset', LEVEL_CELL[breach.level]) : 'bg-secondary/60')}>
      <dt className="text-[11px] text-muted-foreground">
        {metric.short}{metric.unit && ` (${metric.unit})`}
      </dt>
      <dd className={cn('flex flex-wrap items-center gap-x-1 font-semibold tabular-nums', !breach && (value === null ? 'text-muted-foreground' : 'text-foreground'))}>
        {Icon && <Icon className="size-3.5" aria-hidden="true" />}
        {formatValue(value, metric)}
        {value === null && <span className="text-[11px] font-normal">not reported</span>}
        {breach && <span className="text-[11px] font-normal opacity-80">≥ {formatValue(limit, metric)}<span className="sr-only"> ({breach.level})</span></span>}
      </dd>
    </div>
  );
}

function MobileCards({ metrics, breaches, loading }) {
  return (
    <ul className={cn('grid gap-3 transition-opacity md:grid-cols-2', loading && 'opacity-50')} aria-busy={loading}>
      {metrics.map((row) => {
        const playerBreaches = METRICS.filter((m) => breaches.has(`${row.playerId}:${m.key}`));
        return (
          <li key={row.playerId} className="rounded-xl border bg-card p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-medium text-foreground">
                <span className="mr-1.5 text-muted-foreground">#{row.player.shirtNumber}</span>
                {row.player.name}
              </p>
              <div className="flex items-center gap-1.5">
                {playerBreaches.length > 0 && (
                  <Badge variant={playerBreaches.some((m) => breaches.get(`${row.playerId}:${m.key}`).level === 'critical') ? 'critical' : 'warning'}>
                    {playerBreaches.length} alert{playerBreaches.length > 1 ? 's' : ''}
                  </Badge>
                )}
                <Badge variant="outline" title={POSITION_LABELS[row.player.position]}>{row.player.position}</Badge>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-1.5 text-sm min-[420px]:grid-cols-3 md:grid-cols-2">
              {METRICS.map((m) => (
                <MobileMetric key={m.key} metric={m} value={row[m.field]} breach={breaches.get(`${row.playerId}:${m.key}`)} />
              ))}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Métricas de los jugadores. Responsive:
 *  - ≥ lg (1024px): data table de shadcn/ui (TanStack Table) con encabezados ordenables.
 *  - < lg: tarjetas por jugador (1 columna en móvil, 2 en tablet) + selector de orden.
 * En ambos casos el orden lo resuelve el servidor: los componentes solo avisan con onSort(key).
 */
export default function MetricsTable({ metrics, alerts, thresholds, sort, onSort, loading }) {
  const breaches = useMemo(() => indexBreaches(alerts), [alerts]);

  return (
    <div>
      <div className="hidden lg:block">
        <DesktopTable metrics={metrics} breaches={breaches} thresholds={thresholds} sort={sort} onSort={onSort} loading={loading} />
      </div>
      <div className="lg:hidden">
        <MobileSortBar sort={sort} onSort={onSort} loading={loading} />
        <MobileCards metrics={metrics} breaches={breaches} loading={loading} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <TriangleAlert className="size-3.5 text-warning" aria-hidden="true" /> Warning threshold reached
        </span>
        <span className="inline-flex items-center gap-1.5">
          <OctagonAlert className="size-3.5 text-critical" aria-hidden="true" /> Critical threshold reached
        </span>
        <span className="hidden lg:inline"><span className="text-warning">•</span> Metric with threshold (hover the header for values)</span>
        <span>— Not reported</span>
      </div>
    </div>
  );
}
