// Datos de prueba con la forma real de las respuestas de la API (subconjunto de la sesión 103).
export const sessions = [
  { id: 103, date: '2026-09-19', title: 'Partido amistoso vs. Deportivo Ejemplo', type: 'match' },
  { id: 102, date: '2026-09-17', title: 'Entrenamiento de intensidad', type: 'training' },
  { id: 101, date: '2026-09-15', title: 'Entrenamiento táctico', type: 'training' },
];

const row = (playerId, name, position, shirtNumber, m) => ({
  sessionId: 103, playerId, player: { name, position, shirtNumber },
  minutesPlayed: 90, totalDistanceM: 6000, highSpeedRunningM: 500, sprints: 10, maxSpeedKmh: 29.5, accelerations: 30, rpe: 6, workloadAu: 540,
  ...m,
});

export const thresholds = {
  rpe: { warning: 8, critical: null },
  sprints: { warning: 28, critical: null },
  total_distance_m: { warning: 9500, critical: null },
  workload_au: { warning: 600, critical: 750 },
};

export const metricsResponse = {
  session: { id: 103, teamId: 42, date: '2026-09-19', title: 'Partido amistoso vs. Deportivo Ejemplo', type: 'match', durationMin: 90 },
  query: { playerId: null, orderBy: 'shirt_number', order: 'asc' },
  thresholds,
  metrics: [
    row(9, 'Mateo Suárez', 'DF', 3, { rpe: null, workloadAu: null, totalDistanceM: 6262 }),
    row(5, 'Santiago Molina', 'MF', 6, { totalDistanceM: 10488, rpe: 9, workloadAu: 810, maxSpeedKmh: 29.6 }),
    row(11, 'Franco Medina', 'MF', 16, { minutesPlayed: 28, totalDistanceM: 2128, rpe: 5, workloadAu: 140 }),
  ],
  alerts: [
    {
      playerId: 5, name: 'Santiago Molina', level: 'critical',
      breaches: [
        { metric: 'total_distance_m', value: 10488, warning: 9500, critical: null, level: 'warning' },
        { metric: 'workload_au', value: 810, warning: 600, critical: 750, level: 'critical' },
        { metric: 'rpe', value: 9, warning: 8, critical: null, level: 'warning' },
      ],
    },
  ],
};

export const reportResponse = (overrides = {}) => ({
  session: { id: 103, date: '2026-09-19', title: 'Partido amistoso vs. Deportivo Ejemplo', type: 'match' },
  language: 'en',
  audience: 'coach',
  report: {
    summary: 'High-intensity match with an average workload of 554 AU.',
    summarySource: 'ai',
    highlights: [
      { playerId: 5, name: 'Santiago Molina', reason: 'Led the team with 10,488 m.', source: 'ai' },
      { playerId: 10, name: 'Bruno Acosta', reason: 'Covered 8,840 m.', source: 'fallback' },
    ],
    alerts: [
      {
        playerId: 5, name: 'Santiago Molina', level: 'critical',
        breaches: [{ metric: 'workload_au', value: 810, level: 'critical', warning: 600, critical: 750, threshold: 750, excess: 60 }],
        comment: 'Prioritize recovery.', commentSource: 'ai',
      },
    ],
  },
  dataQuality: {
    playersWithoutRpe: [{ playerId: 9, name: 'Mateo Suárez' }],
    lowMinutesPlayers: [{ playerId: 11, name: 'Franco Medina', minutesPlayed: 28 }],
  },
  meta: {
    provider: 'gemini', model: 'gemini-3.1-flash-lite', promptVersion: 'session-report.v1', attempts: 1,
    usage: { inputTokens: 1, outputTokens: 1 },
    validation: { passed: false, issues: [], fallbackFields: ['highlights:10'] },
    generatedAt: '2026-11-10T20:00:00.000Z',
  },
  ...overrides,
});

// Respuesta de fetch simulada
export const jsonResponse = (body, { status = 200, headers = {} } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(headers),
  json: async () => body,
});
