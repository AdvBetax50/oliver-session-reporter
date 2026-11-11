// Estados compartidos (carga, vacío, error) y el badge de nivel de umbral, construidos con shadcn/ui.
import { Inbox, Loader2, OctagonAlert, RotateCw, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
      {label}
    </div>
  );
}

export function EmptyState({ title, description, icon: Icon = Inbox, children }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-secondary text-primary" aria-hidden="true">
        <Icon className="size-5" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  return (
    <Alert variant="destructive" className="border-critical/40 bg-critical/10">
      <OctagonAlert aria-hidden="true" />
      <AlertTitle className="text-critical-fg">{title}</AlertTitle>
      <AlertDescription className="text-soft">
        <p>{error?.message ?? 'Unknown error.'}</p>
        {error?.detail && <p className="text-xs text-muted-foreground">Server detail: {error.detail}</p>}
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 rounded-pill border-critical/50 text-critical-fg hover:bg-critical/15 hover:text-critical-fg">
            <RotateCw aria-hidden="true" /> Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Icono por nivel: la forma distinta (triángulo / octógono) evita depender solo del color.
export const LEVEL_ICONS = { warning: TriangleAlert, critical: OctagonAlert };

export function LevelBadge({ level }) {
  const Icon = LEVEL_ICONS[level];
  return (
    <Badge variant={level}>
      <Icon aria-hidden="true" /> {level === 'critical' ? 'Critical' : 'Warning'}
    </Badge>
  );
}
