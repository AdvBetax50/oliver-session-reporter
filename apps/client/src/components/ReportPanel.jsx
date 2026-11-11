import { useEffect, useRef, useState } from 'react';
import { generateReport } from '../api.js';
import { formatValue, METRICS_BY_KEY, withUnit } from '../metrics.js';
import { Card, EmptyState, ErrorState, LevelBadge, Segmented, Spinner } from './ui.jsx';

const LANGUAGE_OPTIONS = [{ value: 'en', label: 'English' }, { value: 'es', label: 'Español' }];
const AUDIENCE_OPTIONS = [{ value: 'coach', label: 'Coach' }, { value: 'player', label: 'Players' }];

/**
 * Generación del reporte con IA. Estados: idle (vacío) -> loading -> success | error.
 * Se monta con key={sessionId}: al cambiar de sesión se reinicia y se cancela la petición en curso.
 */
export default function ReportPanel({ sessionId }) {
  const [language, setLanguage] = useState('en');
  const [audience, setAudience] = useState('coach');
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const controllerRef = useRef(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function handleGenerate() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const data = await generateReport(sessionId, { language, audience }, { signal: controller.signal });
      setState({ status: 'success', data, error: null });
    } catch (error) {
      if (error.name !== 'AbortError') setState((s) => ({ ...s, status: 'error', error }));
    }
  }

  const loading = state.status === 'loading';
  const report = state.data;
  const outdated = report && (report.language !== language || report.audience !== audience);

  return (
    <Card
      title="AI session report"
      subtitle="Summary, standout players and workload alerts"
      actions={
        <>
          <Segmented label="Report language" value={language} options={LANGUAGE_OPTIONS} onChange={setLanguage} disabled={loading} />
          <Segmented label="Audience" value={audience} options={AUDIENCE_OPTIONS} onChange={setAudience} disabled={loading} />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Spinner className="size-4 text-white" />}
            {loading ? 'Generating…' : report ? 'Regenerate report' : 'Generate report'}
          </button>
        </>
      }
    >
      <div aria-live="polite">
        {state.status === 'error' && (
          <div className="mb-4">
            <ErrorState title="The report could not be generated" error={state.error} onRetry={handleGenerate} />
          </div>
        )}

        {loading && !report && <ReportSkeleton />}

        {!loading && !report && state.status !== 'error' && (
          <EmptyState
            icon="✦"
            title="No report generated yet"
            description="Choose the language and audience, then click “Generate report”. The AI will summarize the session, highlight 2–3 players and flag workload alerts."
          />
        )}

        {report && (
          <div className={loading ? 'pointer-events-none opacity-50' : ''}>
            {outdated && !loading && (
              <p className="mb-4 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
                Language or audience changed. Click “Regenerate report” to apply them.
              </p>
            )}
            <ReportContent data={report} />
          </div>
        )}
      </div>
    </Card>
  );
}

function ReportSkeleton() {
  return (
    <div role="status" className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner className="size-4" /> The AI is analyzing the session. This can take a few seconds…
      </p>
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-full rounded bg-slate-200" />
        <div className="h-3 w-11/12 rounded bg-slate-200" />
        <div className="h-3 w-4/5 rounded bg-slate-200" />
        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <div className="h-20 rounded-lg bg-slate-100" />
          <div className="h-20 rounded-lg bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</h3>;
}

function DataBasedTag({ title }) {
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500 ring-1 ring-slate-200"
      title={title}
    >
      Data-based
    </span>
  );
}

const FALLBACK_TITLE = 'Written from verified data because the AI text did not pass validation';

function ReportContent({ data }) {
  const { report, meta, dataQuality } = data;
  const usedFallback = meta.validation?.fallbackFields?.length > 0;
  const hasQualityNotes = dataQuality && (dataQuality.playersWithoutRpe.length > 0 || dataQuality.lowMinutesPlayers.length > 0);
  return (
    <article className="space-y-6">
      {usedFallback && (
        <p className="rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800 ring-1 ring-sky-200">
          Some parts of the AI answer were incomplete or mentioned data that is not in this session, so they were
          replaced by text generated from the verified data (marked “Data-based”).
        </p>
      )}

      <section>
        <SectionTitle>Summary</SectionTitle>
        <p className="leading-relaxed text-slate-700">
          {report.summary}{' '}
          {report.summarySource === 'fallback' && <DataBasedTag title={FALLBACK_TITLE} />}
        </p>
      </section>

      {hasQualityNotes && (
        <section>
          <SectionTitle>Data notes</SectionTitle>
          <ul className="space-y-1 text-sm text-slate-600">
            {dataQuality.playersWithoutRpe.length > 0 && (
              <li>
                <span className="font-medium">RPE not reported:</span> {dataQuality.playersWithoutRpe.map((p) => p.name).join(', ')} — workload
                cannot be calculated, so no load alert can be evaluated for them.
              </li>
            )}
            {dataQuality.lowMinutesPlayers.length > 0 && (
              <li>
                <span className="font-medium">Low minutes:</span>{' '}
                {dataQuality.lowMinutesPlayers.map((p) => `${p.name} (${p.minutesPlayed} min)`).join(', ')} — totals are not comparable
                with full-session players.
              </li>
            )}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>Standout players</SectionTitle>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {report.highlights.map((h) => (
            <li key={h.playerId} className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="flex items-start justify-between gap-2 font-medium text-emerald-900">
                <span>★ {h.name}</span>
                {h.source === 'fallback' && <DataBasedTag title={FALLBACK_TITLE} />}
              </p>
              <p className="mt-1 text-sm text-emerald-950/80">{h.reason}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>Workload alerts</SectionTitle>
        {report.alerts.length === 0 ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            ✓ No player reached the defined thresholds in this session.
          </p>
        ) : (
          <ul className="space-y-3">
            {report.alerts.map((a) => (
              <li
                key={a.playerId}
                className={`rounded-lg border p-3 ${a.level === 'critical' ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <LevelBadge level={a.level} />
                  <span className="font-medium text-slate-900">{a.name}</span>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {a.breaches.map((b) => {
                    const metric = METRICS_BY_KEY[b.metric];
                    const limit = b.level === 'critical' ? b.critical : b.warning;
                    return (
                      <li key={b.metric} className="rounded bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200">
                        {metric?.label ?? b.metric}: <strong>{metric ? withUnit(b.value, metric) : b.value}</strong>{' '}
                        <span className="text-slate-400">(≥ {formatValue(limit, metric)})</span>
                      </li>
                    );
                  })}
                </ul>
                {a.comment && (
                  <p className="mt-2 text-sm text-slate-700">
                    {a.comment} {a.commentSource === 'fallback' && <DataBasedTag title={FALLBACK_TITLE} />}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="border-t border-slate-100 pt-3 text-xs text-slate-400">
        Generated by {meta.provider} · {meta.model} · prompt {meta.promptVersion} · {meta.attempts} attempt
        {meta.attempts === 1 ? '' : 's'} · {new Date(meta.generatedAt).toLocaleString('en-US')} ·{' '}
        {data.language.toUpperCase()} · {data.audience === 'coach' ? 'Coach' : 'Players'}. AI-generated text: verify before
        making decisions. Alerts are computed from the thresholds, not by the AI.
      </footer>
    </article>
  );
}
