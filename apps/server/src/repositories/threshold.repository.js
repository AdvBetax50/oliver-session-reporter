import { pool } from '../db/pool.js';
import { ThresholdDTO } from '../dtos/index.js';

export async function upsertThreshold(threshold, db = pool) {
  await db.query(
    `INSERT INTO metric_thresholds (team_id, metric, warning, critical) VALUES ($1, $2, $3, $4)
     ON CONFLICT (team_id, metric) DO UPDATE SET warning = EXCLUDED.warning, critical = EXCLUDED.critical`,
    threshold.toParams(),
  );
}

export async function findThresholdsByTeam(teamId, db = pool) {
  const { rows } = await db.query(
    'SELECT team_id, metric, warning, critical FROM metric_thresholds WHERE team_id = $1 ORDER BY metric',
    [teamId],
  );
  return rows.map(ThresholdDTO.fromRow);
}
