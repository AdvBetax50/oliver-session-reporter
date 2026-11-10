import { pool } from '../db/pool.js';
import { PlayerSessionDTO } from '../dtos/index.js';

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

// Métricas de todos los jugadores de una sesión, con los datos del jugador.
export async function findMetricsBySession(sessionId, db = pool) {
  const { rows } = await db.query(
    `SELECT ps.*, p.name AS player_name, p.position AS player_position,
            p.shirt_number AS player_shirt_number
       FROM player_sessions ps
       JOIN players p ON p.id = ps.player_id
      WHERE ps.session_id = $1
      ORDER BY p.shirt_number`,
    [sessionId],
  );
  return rows.map(PlayerSessionDTO.fromRow);
}
