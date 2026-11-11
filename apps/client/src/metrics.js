// Definición de las métricas que muestra la UI.
// `key` es el nombre de la API (order_by, umbrales); `field` es la propiedad en la respuesta (camelCase).
// `description` sigue la "Referencia de campos" del enunciado (sección 9) y alimenta la leyenda.
export const METRICS = [
  { key: 'minutes_played', field: 'minutesPlayed', label: 'Minutes played', short: 'Played', unit: 'min',
    description: 'Minutes the player took part in the session.' },
  { key: 'total_distance_m', field: 'totalDistanceM', label: 'Total distance', short: 'Distance', unit: 'm',
    description: 'Total distance covered, in meters.' },
  { key: 'high_speed_running_m', field: 'highSpeedRunningM', label: 'High-speed running', short: 'HSR', unit: 'm',
    description: 'Meters covered at high speed.' },
  { key: 'sprints', field: 'sprints', label: 'Sprints', short: 'Sprints', unit: '',
    description: 'Number of sprints.' },
  { key: 'max_speed_kmh', field: 'maxSpeedKmh', label: 'Max speed', short: 'Max speed', unit: 'km/h', decimals: 1,
    description: 'Top speed reached, in km/h.' },
  { key: 'accelerations', field: 'accelerations', label: 'Accelerations', short: 'Accel.', unit: '',
    description: 'Number of intense accelerations.' },
  { key: 'rpe', field: 'rpe', label: 'RPE (1–10)', short: 'RPE', unit: '',
    description: 'Rating of Perceived Exertion: effort reported by the player on a 1–10 scale. It can be missing if the player did not report it.' },
  { key: 'workload_au', field: 'workloadAu', label: 'Workload', short: 'Workload', unit: 'AU',
    description: 'Training load = RPE × minutes played, in arbitrary units (AU). It is empty when the RPE is missing.' },
];

export const METRICS_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m]));

// Columnas de texto: orden ascendente por defecto. Métricas: descendente ("quién hizo más").
export const TEXT_SORT_KEYS = ['shirt_number', 'name', 'position'];
export const defaultOrderFor = (key) => (TEXT_SORT_KEYS.includes(key) ? 'asc' : 'desc');

export const POSITION_LABELS = { GK: 'Goalkeeper', DF: 'Defender', MF: 'Midfielder', FW: 'Forward' };

export function formatValue(value, metric) {
  if (value === null || value === undefined) return '—';
  const digits = metric?.decimals ?? 0;
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export const withUnit = (value, metric) =>
  value === null || value === undefined ? 'not reported' : `${formatValue(value, metric)}${metric.unit ? ` ${metric.unit}` : ''}`;

// Fechas 'YYYY-MM-DD' -> 'Sep 19, 2026' (en UTC para no desplazar el día por zona horaria)
export const formatDate = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

// Índice de alertas calculadas por el servidor: "playerId:metric" -> breach
export function indexBreaches(alerts = []) {
  const map = new Map();
  for (const alert of alerts) for (const b of alert.breaches) map.set(`${alert.playerId}:${b.metric}`, b);
  return map;
}
