import { pool } from '../db/pool.js';
import { ORDERABLE_FIELDS, PlayerSessionDTO } from '../dtos/index.js';

// Campo público (?order_by=) -> columna SQL. Nunca se interpola texto del usuario.
const ORDER_COLUMNS = {
  shirt_number: 'p.shirt_number',
  name: 'p.name',
  position: 'p.position',
  minutes_played: 'ps.minutes_played',
  total_distance_m: 'ps.total_distance_m',
  high_speed_running_m: 'ps.high_speed_running_m',
  sprints: 'ps.sprints',
  max_speed_kmh: 'ps.max_speed_kmh',
  accelerations: 'ps.accelerations',
  rpe: 'ps.rpe',
  workload_au: 'ps.workload_au',
};

// Garantiza en el arranque que la lista blanca del DTO y el mapeo a columnas coinciden.
for (const field of ORDERABLE_FIELDS) {
  if (!ORDER_COLUMNS[field]) throw new Error(`Falta la columna para ordenar por "${field}"`);
}

export async function upsertPlayerSession(ps, db = pool) {
  // workload_au no se inserta: es una columna generada.
  await db.query(
    `INSERT INTO player_sessions (session_id, player_id, minutes_played, total_distance_m,
       high_speed_running_m, sprints, max_speed_kmh, accelerations, rpe)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (session_id, player_id) DO UPDATE SET minutes_played = EXCLUDED.minutes_played,
       total_distance_m = EXCLUDED.total_distance_m, high_speed_running_m = EXCLUDED.high_speed_running_m,
       sprints = EXCLUDED.sprints, max_speed_kmh = EXCLUDED.max_speed_kmh,
       accelerations = EXCLUDED.accelerations, rpe = EXCLUDED.rpe`,
    ps.toParams(),
  );
}

// Construye la consulta (función pura, testeable sin base de datos).
export function buildMetricsQuery(sessionId, { playerId = null, orderBy = 'shirt_number', order = 'asc' } = {}) {
  const column = ORDER_COLUMNS[orderBy];
  if (!column) throw new Error(`order_by no permitido: ${orderBy}`);
  const direction = order === 'desc' ? 'DESC' : 'ASC';

  const params = [sessionId];
  let where = 'ps.session_id = $1';
  if (playerId !== null) {
    params.push(playerId);
    where += ` AND ps.player_id = $${params.length}`;
  }

  // NULLS LAST: los RPE no reportados quedan al final en cualquier dirección.
  // Desempate por dorsal para que el orden sea determinista.
  const text = `SELECT ps.*, p.name AS player_name, p.position AS player_position,
            p.shirt_number AS player_shirt_number
       FROM player_sessions ps
       JOIN players p ON p.id = ps.player_id
      WHERE ${where}
      ORDER BY ${column} ${direction} NULLS LAST, p.shirt_number ASC`;
  return { text, params };
}

// Métricas de los jugadores de una sesión, con los datos del jugador.
export async function findMetricsBySession(sessionId, options = {}, db = pool) {
  const { text, params } = buildMetricsQuery(sessionId, options);
  const { rows } = await db.query(text, params);
  return rows.map(PlayerSessionDTO.fromRow);
}
