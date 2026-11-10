import { pool } from '../db/pool.js';
import { SessionDTO } from '../dtos/index.js';

const COLUMNS = 'id, team_id, date, title, type, duration_min';

export async function upsertSession(session, db = pool) {
  await db.query(
    `INSERT INTO sessions (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET team_id = EXCLUDED.team_id, date = EXCLUDED.date,
       title = EXCLUDED.title, type = EXCLUDED.type, duration_min = EXCLUDED.duration_min`,
    session.toParams(),
  );
}

export async function findSessionsByTeam(teamId, db = pool) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM sessions WHERE team_id = $1 ORDER BY date DESC, id DESC`,
    [teamId],
  );
  return rows.map(SessionDTO.fromRow);
}

export async function findSessionById(id, db = pool) {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM sessions WHERE id = $1`, [id]);
  return rows[0] ? SessionDTO.fromRow(rows[0]) : null;
}
