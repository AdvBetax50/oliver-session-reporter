import { pool } from '../db/pool.js';
import { PlayerDTO } from '../dtos/index.js';

const COLUMNS = 'id, team_id, name, position, shirt_number';

export async function upsertPlayer(player, db = pool) {
  await db.query(
    `INSERT INTO players (${COLUMNS}) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET team_id = EXCLUDED.team_id, name = EXCLUDED.name,
       position = EXCLUDED.position, shirt_number = EXCLUDED.shirt_number`,
    player.toParams(),
  );
}

export async function findPlayersByTeam(teamId, db = pool) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM players WHERE team_id = $1 ORDER BY shirt_number`,
    [teamId],
  );
  return rows.map(PlayerDTO.fromRow);
}
