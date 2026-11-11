import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getSessionMetrics, getSessions } from './api.js';
import { useAsync } from './hooks/useAsync.js';
import { defaultOrderFor, formatDate } from './metrics.js';
import MetricChart from './components/MetricChart.jsx';
import MetricsTable from './components/MetricsTable.jsx';
import ReportPanel from './components/ReportPanel.jsx';
import SessionSelector, { SessionTypeBadge } from './components/SessionSelector.jsx';
import GlossaryDialog from './components/GlossaryDialog.jsx';
import { EmptyState, ErrorState, LoadingState } from './components/states.jsx';

const DEFAULT_SORT = { orderBy: 'shirt_number', order: 'asc' };

// Tarjeta de sección (shadcn Card) con título y descripción.
function SectionCard({ title, description, action, children }) {
  return (
    <Card className="gap-4 bg-card/90 py-4 backdrop-blur sm:gap-6 sm:py-6">
      <CardHeader className="border-b px-4 sm:px-6 [.border-b]:pb-4 sm:[.border-b]:pb-6">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="px-4 sm:px-6">{children}</CardContent>
    </Card>
  );
}

export default function App() {
  const sessions = useAsync((signal) => getSessions({ signal }), []);
  const [sessionId, setSessionId] = useState(null);
  const [sort, setSort] = useState(DEFAULT_SORT);

  // Selecciona por defecto la sesión más reciente (la API las devuelve ordenadas).
  useEffect(() => {
    if (sessionId === null && sessions.data?.length) setSessionId(sessions.data[0].id);
  }, [sessions.data, sessionId]);

  const metrics = useAsync(
    (signal) => getSessionMetrics(sessionId, sort, { signal }),
    [sessionId, sort.orderBy, sort.order],
    { enabled: sessionId !== null },
  );

  function handleSort(key) {
    setSort((s) => (s.orderBy === key ? { orderBy: key, order: s.order === 'asc' ? 'desc' : 'asc' } : { orderBy: key, order: defaultOrderFor(key) }));
  }

  // Los datos visibles solo valen si son de la sesión seleccionada (evita mostrar otra sesión mientras carga).
  const current = metrics.data?.session?.id === sessionId ? metrics.data : null;
  const session = sessions.data?.find((s) => s.id === sessionId);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen">
        {/* Fijo solo desde md: en móvil ocuparía buena parte de la pantalla */}
        <header className="z-20 border-b bg-background/85 backdrop-blur md:sticky md:top-0">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-brand-deep to-primary" aria-hidden="true">
                <Activity className="size-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                  Oliver <span className="font-normal text-soft">· Session review</span>
                </h1>
                <p className="text-xs text-muted-foreground sm:text-sm">Player performance metrics and AI-assisted reports</p>
              </div>
            </div>
            {sessions.status === 'success' && sessions.data.length > 0 && (
              <SessionSelector
                sessions={sessions.data}
                value={sessionId}
                onChange={(id) => { setSessionId(id); setSort(DEFAULT_SORT); }}
              />
            )}
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6">
          {sessions.status === 'loading' && <Card><LoadingState label="Loading sessions…" /></Card>}

          {sessions.status === 'error' && (
            <ErrorState title="Sessions could not be loaded" error={sessions.error} onRetry={sessions.reload} />
          )}

          {sessions.status === 'success' && sessions.data.length === 0 && (
            <Card>
              <EmptyState title="No sessions yet" description="Load the sample data with “npm run db:setup” and reload the page." />
            </Card>
          )}

          {session && (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold text-foreground sm:text-xl">{session.title}</h2>
                <SessionTypeBadge type={session.type} />
                <span className="text-sm text-muted-foreground">{formatDate(session.date)}</span>
                {current && (
                  <span className="text-sm text-muted-foreground">· {current.session.durationMin} min · {current.metrics.length} players</span>
                )}
              </div>

              <SectionCard title="Player metrics" action={<GlossaryDialog thresholds={current?.thresholds} />} description="Sortable by any metric (sorted on the server). Highlighted values reached a threshold.">
                {metrics.status === 'error' && (
                  <div className="mb-4"><ErrorState title="Metrics could not be loaded" error={metrics.error} onRetry={metrics.reload} /></div>
                )}
                {!current && metrics.status === 'loading' && <LoadingState label="Loading metrics…" />}
                {current && current.metrics.length === 0 && (
                  <EmptyState title="No metrics for this session" description="No player data was recorded for this session." />
                )}
                {current && current.metrics.length > 0 && (
                  <MetricsTable
                    metrics={current.metrics}
                    alerts={current.alerts}
                    thresholds={current.thresholds}
                    sort={sort}
                    onSort={handleSort}
                    loading={metrics.status === 'loading'}
                  />
                )}
              </SectionCard>

              {/* Gráfico y reporte apilados (flex en columna) */}
              <div className="flex flex-col gap-4 sm:gap-6">
                <SectionCard title="Metric by player" description="Highest first. Dashed lines mark the thresholds.">
                  {!current && metrics.status === 'loading' && <LoadingState label="Loading chart…" />}
                  {!current && metrics.status === 'error' && <EmptyState title="Chart unavailable" description="Metrics could not be loaded." />}
                  {current && current.metrics.length === 0 && <EmptyState title="Nothing to chart" />}
                  {current && current.metrics.length > 0 && (
                    <MetricChart metrics={current.metrics} alerts={current.alerts} thresholds={current.thresholds} />
                  )}
                </SectionCard>

                <ReportPanel key={sessionId} sessionId={sessionId} />
              </div>
            </>
          )}
        </main>
        <Toaster position="bottom-right" richColors />
      </div>
    </TooltipProvider>
  );
}
