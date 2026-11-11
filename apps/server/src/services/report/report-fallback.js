// Textos de respaldo generados por código, usados cuando un campo de la respuesta del modelo
// no supera la validación ni siquiera tras el reintento. Solo usan valores del contexto,
// así que pasan el mismo validador (hay un test que lo garantiza).

const fmt = { es: 'es-AR', en: 'en-US' };
const n = (language, value) => value.toLocaleString(fmt[language], { maximumFractionDigits: 1 });

const METRIC_NAMES = {
  es: { workload_au: 'carga de trabajo', total_distance_m: 'distancia total', sprints: 'sprints', rpe: 'RPE' },
  en: { workload_au: 'workload', total_distance_m: 'total distance', sprints: 'sprints', rpe: 'RPE' },
};
const UNITS = { workload_au: ' AU', total_distance_m: ' m', sprints: '', rpe: '' };
const list = (items, language) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${language === 'es' ? 'y' : 'and'} ${items.at(-1)}`;

export function fallbackSummary(context, language) {
  const t = context.team_summary;
  const q = context.data_quality;
  const L = (v) => n(language, v);
  const parts = [];

  if (language === 'es') {
    parts.push(`Sesión "${context.session.title}" de ${L(context.session.duration_min)} min con ${L(t.players)} jugadores.`);
    if (t.avg_distance_m !== null) parts.push(`Distancia promedio: ${L(t.avg_distance_m)} m (${L(t.avg_distance_per_min)} m/min).`);
    if (t.avg_rpe !== null) parts.push(`RPE promedio: ${L(t.avg_rpe)}, reportado por ${L(t.rpe_reported_by)} jugadores.`);
    parts.push(t.players_with_alerts
      ? `${L(t.players_with_alerts)} jugadores alcanzaron umbrales de carga (${L(t.players_with_critical_alerts)} en nivel crítico).`
      : 'Ningún jugador alcanzó los umbrales definidos.');
    if (q.players_without_rpe.length) parts.push(`Sin RPE reportado: ${list(q.players_without_rpe.map((p) => p.name), language)}.`);
    if (q.low_minutes_players.length) {
      parts.push(`Con pocos minutos: ${list(q.low_minutes_players.map((p) => `${p.name} (${L(p.minutes_played)} min)`), language)}.`);
    }
  } else {
    parts.push(`Session "${context.session.title}": ${L(context.session.duration_min)} min with ${L(t.players)} players.`);
    if (t.avg_distance_m !== null) parts.push(`Average distance: ${L(t.avg_distance_m)} m (${L(t.avg_distance_per_min)} m/min).`);
    if (t.avg_rpe !== null) parts.push(`Average RPE: ${L(t.avg_rpe)}, reported by ${L(t.rpe_reported_by)} players.`);
    parts.push(t.players_with_alerts
      ? `${L(t.players_with_alerts)} players reached load thresholds (${L(t.players_with_critical_alerts)} at critical level).`
      : 'No player reached the defined thresholds.');
    if (q.players_without_rpe.length) parts.push(`RPE not reported: ${list(q.players_without_rpe.map((p) => p.name), language)}.`);
    if (q.low_minutes_players.length) {
      parts.push(`Low minutes: ${list(q.low_minutes_players.map((p) => `${p.name} (${L(p.minutes_played)} min)`), language)}.`);
    }
  }
  return parts.join(' ');
}

export function fallbackHighlightReason(player, language) {
  const L = (v) => n(language, v);
  return language === 'es'
    ? `Recorrió ${L(player.total_distance_m)} m (${L(player.distance_per_min)} m/min) y ${L(player.high_speed_running_m)} m a alta velocidad, entre los valores más altos del equipo.`
    : `Covered ${L(player.total_distance_m)} m (${L(player.distance_per_min)} m/min) and ${L(player.high_speed_running_m)} m of high-speed running, among the highest in the team.`;
}

// Jugadores para completar los destacados: mayor distancia, excluyendo a quienes jugaron pocos minutos.
export function fallbackHighlightCandidates(context, excludeIds) {
  return context.players
    .filter((p) => !p.low_minutes && p.distance_per_min !== null && !excludeIds.has(p.player_id))
    .sort((a, b) => b.total_distance_m - a.total_distance_m);
}

export function fallbackAlertComment(alert, language) {
  const L = (v) => n(language, v);
  const items = alert.breaches.map((b) => {
    const name = METRIC_NAMES[language][b.metric] ?? b.metric;
    const limit = `${L(b.threshold_reached)}${UNITS[b.metric] ?? ''}`;
    return language === 'es'
      ? `${name} ${L(b.value)}${UNITS[b.metric] ?? ''} (umbral ${b.level === 'critical' ? 'crítico' : 'de advertencia'} ${limit})`
      : `${name} ${L(b.value)}${UNITS[b.metric] ?? ''} (${b.level} threshold ${limit})`;
  });
  return language === 'es'
    ? `Alcanzó ${list(items, language)}. Conviene revisar su carga y priorizar la recuperación.`
    : `Reached ${list(items, language)}. Review the load and prioritize recovery.`;
}
