import { pool } from '../db/pool.js';
import { TeamDTO } from '../dtos/index.js';

// `db` puede ser el pool o un cliente dentro de una transacción.
export async function upsertTeam(team, db = pool) {
  await db.query(
    `INSERT INTO teams (id, name, sport) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sport = EXCLUDED.sport`,
    team.toParams(),
  );
}

export async function findTeamById(id, db = pool) {
  const { rows } = await db.query('SELECT id, name, sport FROM teams WHERE id = $1', [id]);
  return rows[0] ? TeamDTO.fromRow(rows[0]) : null;
}

export async function findAllTeams(db = pool) {
  const { rows } = await db.query('SELECT id, name, sport FROM teams ORDER BY name');
  return rows.map(TeamDTO.fromRow);
}
