import { useEffect, useRef, useState } from 'react';
import { CircleCheck, Info, Loader2, Sparkles, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { generateReport } from '../api.js';
import { formatValue, METRICS_BY_KEY, withUnit } from '../metrics.js';
import { EmptyState, ErrorState, LevelBadge } from './states.jsx';

const LANGUAGE_OPTIONS = [{ value: 'en', label: 'English' }, { value: 'es', label: 'Español' }];
const AUDIENCE_OPTIONS = [{ value: 'coach', label: 'Coach' }, { value: 'player', label: 'Players' }];
const FALLBACK_TITLE = 'Written from verified data because the AI text did not pass validation';

// Control segmentado: ToggleGroup de shadcn en modo "single" (nunca queda vacío).
function Segmented({ label, value, options, onChange, disabled }) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      aria-label={label}
      value={value}
      onValueChange={(v) => v && onChange(v)}
      disabled={disabled}
      className="rounded-pill bg-secondary"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="px-3 first:rounded-l-pill last:rounded-r-pill data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function DataBasedTag() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" tabIndex={0} className="cursor-help align-middle text-[10px] uppercase text-soft">
          Data-based
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{FALLBACK_TITLE}</TooltipContent>
    </Tooltip>
  );
}

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
      if (controller.signal.aborted) return; // llegó una respuesta de una petición ya reemplazada o desmontada
      setState({ status: 'success', data, error: null });
      toast.success('Report generated', {
        description: data.meta.validation?.passed ? 'All figures verified against the session data.' : 'Some parts were replaced by verified data.',
      });
    } catch (error) {
      if (error.name === 'AbortError' || controller.signal.aborted) return;
      setState((s) => ({ ...s, status: 'error', error }));
      toast.error('The report could not be generated', { description: error.message });
    }
  }

  const loading = state.status === 'loading';
  const report = state.data;
  const outdated = report && (report.language !== language || report.audience !== audience);

  return (
    <Card className="gap-4 bg-card/90 py-4 backdrop-blur sm:gap-6 sm:py-6">
      {/* En móvil los controles bajan debajo del título; desde md quedan a la derecha (CardAction) */}
      <CardHeader className="border-b px-4 sm:px-6 [.border-b]:pb-4 sm:[.border-b]:pb-6 has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-pink" aria-hidden="true" /> AI session report
        </CardTitle>
        <CardDescription>Summary, standout players and workload alerts</CardDescription>
        <CardAction className="col-start-1 row-span-1 row-start-3 mt-2 flex w-full flex-wrap items-center gap-2 justify-self-stretch md:w-auto md:col-start-2 md:row-span-2 md:row-start-1 md:mt-0 md:justify-end md:justify-self-end">
          <Segmented label="Report language" value={language} options={LANGUAGE_OPTIONS} onChange={setLanguage} disabled={loading} />
          <Segmented label="Audience" value={audience} options={AUDIENCE_OPTIONS} onChange={setAudience} disabled={loading} />
          {/* Botón primario con el degradado azul de los botones de oliversports.ai */}
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full rounded-pill bg-linear-to-r from-brand-deep to-primary px-5 sm:w-auto font-semibold shadow-md shadow-black/30 hover:from-primary hover:to-brand-deep"
          >
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {loading ? 'Generating…' : report ? 'Regenerate report' : 'Generate report'}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent aria-live="polite" className="px-4 sm:px-6">
        {state.status === 'error' && (
          <div className="mb-4">
            <ErrorState title="The report could not be generated" error={state.error} onRetry={handleGenerate} />
          </div>
        )}

        {loading && !report && <ReportSkeleton />}

        {!loading && !report && state.status !== 'error' && (
          <EmptyState
            icon={Sparkles}
            title="No report generated yet"
            description="Choose the language and audience, then click “Generate report”. The AI will summarize the session, highlight 2–3 players and flag workload alerts."
          />
        )}

        {report && (
          <div className={cn(loading && 'pointer-events-none opacity-50')}>
            {outdated && !loading && (
              <Alert role="status" className="mb-4 bg-secondary">
                <Info aria-hidden="true" />
                <AlertDescription>Language or audience changed. Click “Regenerate report” to apply them.</AlertDescription>
              </Alert>
            )}
            <ReportContent data={report} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportSkeleton() {
  return (
    <div role="status" className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" /> The AI is analyzing the session. This can take a few seconds…
      </p>
      <div className="space-y-3">
        <Skeleton className="h-3 w-full bg-secondary" />
        <Skeleton className="h-3 w-11/12 bg-secondary" />
        <Skeleton className="h-3 w-4/5 bg-secondary" />
        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <Skeleton className="h-20 rounded-xl bg-secondary" />
          <Skeleton className="h-20 rounded-xl bg-secondary" />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

function ReportContent({ data }) {
  const { report, meta, dataQuality } = data;
  const usedFallback = meta.validation?.fallbackFields?.length > 0;
  const hasQualityNotes = dataQuality && (dataQuality.playersWithoutRpe.length > 0 || dataQuality.lowMinutesPlayers.length > 0);

  return (
    <article className="space-y-5 sm:space-y-6">
      {usedFallback && (
        <Alert role="status" className="border-primary/40 bg-primary/10">
          <Info className="text-primary" aria-hidden="true" />
          <AlertDescription className="text-soft">
            Some parts of the AI answer were incomplete or mentioned data that is not in this session, so they were replaced by text
            generated from the verified data (marked “Data-based”).
          </AlertDescription>
        </Alert>
      )}

      <section>
        <SectionTitle>Summary</SectionTitle>
        <p className="leading-relaxed text-soft">
          {report.summary} {report.summarySource === 'fallback' && <DataBasedTag />}
        </p>
      </section>

      {hasQualityNotes && (
        <section>
          <SectionTitle>Data notes</SectionTitle>
          <ul className="space-y-1 text-sm text-soft">
            {dataQuality.playersWithoutRpe.length > 0 && (
              <li>
                <span className="font-medium text-foreground">RPE not reported:</span> {dataQuality.playersWithoutRpe.map((p) => p.name).join(', ')} —
                workload cannot be calculated, so no load alert can be evaluated for them.
              </li>
            )}
            {dataQuality.lowMinutesPlayers.length > 0 && (
              <li>
                <span className="font-medium text-foreground">Low minutes:</span>{' '}
                {dataQuality.lowMinutesPlayers.map((p) => `${p.name} (${p.minutesPlayed} min)`).join(', ')} — totals are not comparable with
                full-session players.
              </li>
            )}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>Standout players</SectionTitle>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {report.highlights.map((h) => (
            <li key={h.playerId} className="rounded-xl border border-primary/40 bg-primary/10 p-3">
              <p className="flex items-start justify-between gap-2 font-medium text-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Star className="size-4 fill-pink text-pink" aria-hidden="true" /> {h.name}
                </span>
                {h.source === 'fallback' && <DataBasedTag />}
              </p>
              <p className="mt-1 text-sm text-soft">{h.reason}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>Workload alerts</SectionTitle>
        {report.alerts.length === 0 ? (
          <Alert role="status" className="border-success/40 bg-success/10">
            <CircleCheck className="text-success" aria-hidden="true" />
            <AlertDescription className="text-success">No player reached the defined thresholds in this session.</AlertDescription>
          </Alert>
        ) : (
          <ul className="space-y-3">
            {report.alerts.map((a) => (
              <li
                key={a.playerId}
                className={cn('rounded-xl border p-3', a.level === 'critical' ? 'border-critical/40 bg-critical/10' : 'border-warning/40 bg-warning/10')}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <LevelBadge level={a.level} />
                  <span className="font-medium text-foreground">{a.name}</span>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {a.breaches.map((b) => {
                    const metric = METRICS_BY_KEY[b.metric];
                    const limit = b.level === 'critical' ? b.critical : b.warning;
                    return (
                      <li key={b.metric}>
                        <Badge variant="outline" className="bg-secondary font-normal text-soft">
                          {metric?.label ?? b.metric}: <strong className="text-foreground">{metric ? withUnit(b.value, metric) : b.value}</strong>
                          <span className="text-muted-foreground">(≥ {formatValue(limit, metric)})</span>
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
                {a.comment && (
                  <p className="mt-2 text-sm text-soft">
                    {a.comment} {a.commentSource === 'fallback' && <DataBasedTag />}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="border-t pt-3 text-xs text-muted-foreground">
        Generated by {meta.provider} · {meta.model} · prompt {meta.promptVersion} · {meta.attempts} attempt
        {meta.attempts === 1 ? '' : 's'} · {new Date(meta.generatedAt).toLocaleString('en-US')} · {data.language.toUpperCase()} ·{' '}
        {data.audience === 'coach' ? 'Coach' : 'Players'}. AI-generated text: verify before making decisions. Alerts are computed from the
        thresholds, not by the AI.
      </footer>
    </article>
  );
}
