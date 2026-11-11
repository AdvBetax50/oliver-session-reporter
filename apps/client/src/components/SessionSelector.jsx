import { formatDate } from '../metrics.js';

const TYPE_LABELS = { training: 'Training', match: 'Match' };

export default function SessionSelector({ sessions, value, onChange, disabled }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <label htmlFor="session" className="text-sm font-medium text-slate-600">
        Session
      </label>
      <select
        id="session"
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none sm:w-96"
      >
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {formatDate(s.date)} · {TYPE_LABELS[s.type] ?? s.type} · {s.title}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SessionTypeBadge({ type }) {
  const styles = type === 'match' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles}`}>{TYPE_LABELS[type] ?? type}</span>;
}
