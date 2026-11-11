// Piezas de UI reutilizables.

export function Card({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Spinner({ className = 'size-5' }) {
  return (
    <svg className={`animate-spin text-indigo-600 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
      <Spinner />
      {label}
    </div>
  );
}

export function EmptyState({ title, description, icon = '∅', children }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-400" aria-hidden="true">
        {icon}
      </div>
      <p className="font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="font-medium text-red-800">{title}</p>
      <p className="mt-1 text-sm text-red-700">{error?.message ?? 'Unknown error.'}</p>
      {error?.detail && <p className="mt-1 text-xs text-red-600/80">Server detail: {error.detail}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-100">
          Try again
        </button>
      )}
    </div>
  );
}

const LEVEL_STYLES = {
  critical: 'bg-red-100 text-red-800 ring-red-200',
  warning: 'bg-amber-100 text-amber-800 ring-amber-200',
};

export function LevelBadge({ level }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${LEVEL_STYLES[level]}`}>
      {level === 'critical' ? '▲▲' : '▲'} {level === 'critical' ? 'Critical' : 'Warning'}
    </span>
  );
}

// Grupo de botones excluyentes (segmented control), accesible como radiogroup.
export function Segmented({ label, value, options, onChange, disabled }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition disabled:opacity-50 ${
            value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
