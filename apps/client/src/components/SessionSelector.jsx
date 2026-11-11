import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '../metrics.js';

const TYPE_LABELS = { training: 'Training', match: 'Match' };

export default function SessionSelector({ sessions, value, onChange, disabled }) {
  return (
    <div className="flex w-full flex-col gap-1.5 lg:w-auto lg:flex-row lg:items-center lg:gap-3">
      <Label htmlFor="session" className="text-soft">Session</Label>
      {/* Siempre controlado: "" (sin selección) muestra el placeholder hasta que llega la sesión por defecto */}
      <Select value={value === null ? '' : String(value)} onValueChange={(v) => onChange(Number(v))} disabled={disabled}>
        <SelectTrigger
          id="session"
          // Escritorio (lg): el ancho se ajusta al contenido (fecha + título + tipo) sin recortar.
          // Móvil/tablet: ancho completo; si no entra, el texto pasa a otra línea y el trigger crece
          // (data-[size=default]:h-auto anula la altura fija h-9 del trigger de shadcn).
          className="min-h-9 w-full whitespace-normal rounded-2xl bg-secondary py-1.5 text-left data-[size=default]:h-auto *:data-[slot=select-value]:line-clamp-none lg:w-auto lg:min-w-[24rem] lg:whitespace-nowrap lg:rounded-pill"
        >
          <SelectValue placeholder="Select a session" />
        </SelectTrigger>
        <SelectContent position="popper" align="end" className="max-w-[calc(100vw-2rem)]">
          {sessions.map((s) => (
            <SelectItem key={s.id} value={String(s.id)} className="whitespace-normal">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-muted-foreground">{formatDate(s.date)}</span>
                <span>{s.title}</span>
                <SessionTypeBadge type={s.type} />
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SessionTypeBadge({ type }) {
  return <Badge variant={type === 'match' ? 'pink' : 'brand'}>{TYPE_LABELS[type] ?? type}</Badge>;
}
