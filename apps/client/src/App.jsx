import { useEffect, useState } from 'react';
import { getSessionMetrics, getSessions } from './api.js';
import { useAsync } from './hooks/useAsync.js';
import { defaultOrderFor, formatDate } from './metrics.js';
import MetricChart from './components/MetricChart.jsx';
import MetricsTable from './components/MetricsTable.jsx';
import ReportPanel from './components/ReportPanel.jsx';
import SessionSelector, { SessionTypeBadge } from './components/SessionSelector.jsx';
import { Card, EmptyState, ErrorState, LoadingState } from './components/ui.jsx';

const DEFAULT_SORT = { orderBy: 'shirt_number', order: 'asc' };

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
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              Oliver <span className="font-normal text-slate-400">· Session review</span>
            </h1>
            <p className="text-sm text-slate-500">Player performance metrics and AI-assisted reports</p>
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

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
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
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-900">{session.title}</h2>
              <SessionTypeBadge type={session.type} />
              <span className="text-sm text-slate-500">{formatDate(session.date)}</span>
              {current && <span className="text-sm text-slate-500">· {current.session.durationMin} min · {current.metrics.length} players</span>}
            </div>

            <Card title="Player metrics" subtitle="Click a column header to sort. Highlighted values reached a threshold.">
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
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Metric by player" subtitle="Highest first. Dashed lines mark the thresholds.">
                {!current && metrics.status === 'loading' && <LoadingState label="Loading chart…" />}
                {!current && metrics.status === 'error' && <EmptyState title="Chart unavailable" description="Metrics could not be loaded." />}
                {current && current.metrics.length === 0 && <EmptyState title="Nothing to chart" />}
                {current && current.metrics.length > 0 && (
                  <MetricChart metrics={current.metrics} alerts={current.alerts} thresholds={current.thresholds} />
                )}
              </Card>

              <ReportPanel key={sessionId} sessionId={sessionId} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
