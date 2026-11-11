// Construye el contexto de datos que se envía al modelo. Función pura.
//
// Principio: el código calcula y el modelo redacta. Se envían ya resueltos los promedios,
// comparaciones, rankings, alertas y casos borde, porque (a) los LLM fallan con la aritmética
// y (b) el validador solo acepta números que estén literalmente en este contexto.

// Un jugador con menos de la mitad de los minutos de la sesión se marca como "pocos minutos":
// sus totales no son comparables con los de quien jugó la sesión completa.
export const LOW_MINUTES_RATIO = 0.5;

const round = (n, d = 1) => (n === null || n === undefined || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

const RANKED_METRICS = [
  ['total_distance_m', (p) => p.total_distance_m],
  ['distance_per_min', (p) => p.distance_per_min],
  ['high_speed_running_m', (p) => p.high_speed_running_m],
  ['sprints', (p) => p.sprints],
  ['max_speed_kmh', (p) => p.max_speed_kmh],
  ['accelerations', (p) => p.accelerations],
];

export function buildReportContext({ session, metrics, thresholds }, alerts) {
  const isLowMinutes = (m) => m.minutesPlayed < session.durationMin * LOW_MINUTES_RATIO;

  // Promedios del equipo sin los jugadores con pocos minutos (no distorsionan el "jugador típico").
  const regulars = metrics.filter((m) => !isLowMinutes(m));
  const base = regulars.length ? regulars : metrics;
  const avgDistance = avg(base.map((m) => m.totalDistanceM));
  const reportedRpe = metrics.filter((m) => m.rpe !== null);
  const reportedWorkload = metrics.filter((m) => m.workloadAu !== null);

  const players = metrics.map((m) => ({
    player_id: m.playerId,
    name: m.player?.name ?? null,
    shirt_number: m.player?.shirtNumber ?? null,
    position: m.player?.position ?? null,
    minutes_played: m.minutesPlayed,
    low_minutes: isLowMinutes(m),
    total_distance_m: m.totalDistanceM,
    distance_per_min: m.minutesPlayed > 0 ? round(m.totalDistanceM / m.minutesPlayed) : null,
    distance_vs_team_avg_pct: avgDistance ? round((m.totalDistanceM / avgDistance - 1) * 100, 0) : null,
    high_speed_running_m: m.highSpeedRunningM,
    sprints: m.sprints,
    max_speed_kmh: m.maxSpeedKmh,
    accelerations: m.accelerations,
    rpe: m.rpe,
    rpe_reported: m.rpe !== null,
    workload_au: m.workloadAu,
  }));

  const rankings = Object.fromEntries(
    RANKED_METRICS.map(([key, get]) => [
      key,
      players
        .filter((p) => get(p) !== null)
        .sort((a, b) => get(b) - get(a))
        .slice(0, 3)
        .map((p, i) => ({ rank: i + 1, player_id: p.player_id, name: p.name, value: get(p), low_minutes: p.low_minutes })),
    ]),
  );

  const computedAlerts = alerts.map((a) => ({
    player_id: a.playerId,
    name: a.name,
    level: a.level,
    breaches: a.breaches.map((b) => {
      const limit = b.level === 'critical' ? b.critical : b.warning;
      return {
        metric: b.metric,
        value: b.value,
        level: b.level,
        threshold_reached: limit,
        warning: b.warning,
        critical: b.critical,
        excess: round(b.value - limit),
        excess_pct: round((b.value / limit - 1) * 100, 0),
      };
    }),
  }));

  return {
    session: {
      id: session.id,
      date: session.date,
      title: session.title,
      type: session.type,
      duration_min: session.durationMin,
    },
    thresholds: Object.fromEntries(thresholds.map((t) => [t.metric, { warning: t.warning, critical: t.critical }])),
    team_summary: {
      players: metrics.length,
      averages_exclude_low_minutes_players: regulars.length !== metrics.length && regulars.length > 0,
      avg_distance_m: round(avgDistance, 0),
      avg_distance_per_min: round(avg(metrics.filter((m) => m.minutesPlayed > 0).map((m) => m.totalDistanceM / m.minutesPlayed))),
      avg_high_speed_running_m: round(avg(base.map((m) => m.highSpeedRunningM)), 0),
      avg_sprints: round(avg(base.map((m) => m.sprints))),
      avg_max_speed_kmh: round(avg(base.map((m) => m.maxSpeedKmh))),
      avg_rpe: round(avg(reportedRpe.map((m) => m.rpe))),
      rpe_reported_by: reportedRpe.length,
      avg_workload_au: round(avg(reportedWorkload.map((m) => m.workloadAu)), 0),
      players_with_alerts: alerts.length,
      players_with_critical_alerts: alerts.filter((a) => a.level === 'critical').length,
    },
    data_quality: {
      players_without_rpe: players.filter((p) => !p.rpe_reported).map((p) => ({ player_id: p.player_id, name: p.name })),
      low_minutes_players: players
        .filter((p) => p.low_minutes)
        .map((p) => ({ player_id: p.player_id, name: p.name, minutes_played: p.minutes_played })),
    },
    players,
    rankings,
    computed_alerts: computedAlerts,
  };
}
