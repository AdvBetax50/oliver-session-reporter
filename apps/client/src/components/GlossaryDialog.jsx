import { BookOpen, OctagonAlert, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogClose, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { formatValue, METRICS, METRICS_BY_KEY } from '../metrics.js';

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Term({ name, code, unit, children }) {
  return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2">
      <dt className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium text-foreground">{name}</span>
        {unit && <span className="text-xs text-muted-foreground">({unit})</span>}
        {code && <code className="font-mono text-[11px] text-muted-foreground">{code}</code>}
      </dt>
      <dd className="mt-0.5 text-sm text-soft">{children}</dd>
    </div>
  );
}

/**
 * Leyenda de conceptos (Dialog de shadcn/ui): métricas según la referencia de campos del enunciado,
 * los umbrales reales de la sesión y los conceptos propios de la app (alertas, datos faltantes, reporte de IA).
 */
export default function GlossaryDialog({ thresholds }) {
  const thresholdEntries = Object.entries(thresholds ?? {});

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-pill bg-secondary">
          <BookOpen aria-hidden="true" /> Legend
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" aria-hidden="true" /> Legend
          </DialogTitle>
          <DialogDescription>What each metric, threshold and indicator in this app means.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Section title="Player metrics">
            <dl className="grid gap-2 sm:grid-cols-2">
              {METRICS.map((m) => (
                <Term key={m.key} name={m.label} unit={m.unit} code={m.key}>{m.description}</Term>
              ))}
            </dl>
          </Section>

          <Section title="Thresholds">
            <p className="text-sm text-soft">
              The team&apos;s reference limits (<code className="font-mono text-xs">thresholds</code>). Reaching the <em>warning</em> or{' '}
              <em>critical</em> value generates an alert. Alerts are computed by the app from these values, never by the AI.
            </p>
            {thresholdEntries.length > 0 && (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Metric</th>
                      <th className="px-3 py-2 text-right font-medium">Warning ≥</th>
                      <th className="px-3 py-2 text-right font-medium">Critical ≥</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {thresholdEntries.map(([key, t]) => {
                      const m = METRICS_BY_KEY[key];
                      const unit = m?.unit ? ` ${m.unit}` : '';
                      return (
                        <tr key={key}>
                          <td className="px-3 py-2 text-foreground">{m?.label ?? key}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-warning-fg">{formatValue(t.warning, m)}{unit}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-critical-fg">
                            {t.critical == null ? <span className="text-muted-foreground">—</span> : `${formatValue(t.critical, m)}${unit}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Indicators">
            <dl className="grid gap-2 sm:grid-cols-2">
              <Term name={<span className="inline-flex items-center gap-1.5"><Badge variant="warning"><TriangleAlert aria-hidden="true" /> Warning</Badge></span>}>
                The value reached the warning threshold. Highlighted in yellow with a triangle.
              </Term>
              <Term name={<span className="inline-flex items-center gap-1.5"><Badge variant="critical"><OctagonAlert aria-hidden="true" /> Critical</Badge></span>}>
                The value reached the critical threshold. Highlighted in red with an octagon.
              </Term>
              <Term name="— Not reported">
                The player did not report the value (e.g. RPE). No value is assumed, so no alert can be evaluated for it.
              </Term>
              <Term name="Low minutes">
                Played less than half of the session. Totals are not comparable with full-session players, so the report compares them per minute.
              </Term>
              <Term name={<Badge variant="outline" className="text-[10px] uppercase text-soft">Data-based</Badge>}>
                Part of the AI report that was replaced by text generated from the verified data, because the AI answer did not pass validation.
              </Term>
              <Term name={<span className="inline-flex gap-1"><Badge variant="pink">Match</Badge><Badge variant="brand">Training</Badge></span>}>
                Session type.
              </Term>
            </dl>
          </Section>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button className="rounded-pill">Got it</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
