// Carga los datos de db/seeds/data.json en la base de datos.
// 1. Valida todo el JSON y lo convierte en DTOs (sin tocar la BD).
// 2. Inserta mediante los repositorios en una sola transacción (o se carga todo o nada).
// 3. Idempotente: los repositorios usan UPSERT, se puede ejecutar varias veces.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, connectOrExit } from '../src/db/pool.js';
import { parseSeedData } from '../src/db/parse-seed-data.js';
import {
  upsertPlayer, upsertPlayerSession, upsertSession, upsertTeam, upsertThreshold,
} from '../src/repositories/index.js';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'seeds', 'data.json');

let data;
try {
  data = parseSeedData(JSON.parse(await readFile(file, 'utf8')));
} catch (err) {
  console.error(`JSON inválido (${err.name}): ${err.message}`);
  process.exit(1);
}
data.warnings.forEach((w) => console.warn(`⚠ ${w}`));

const client = await connectOrExit();
try {
  await client.query('BEGIN');
  await upsertTeam(data.team, client);
  for (const t of data.thresholds) await upsertThreshold(t, client);
  for (const p of data.players) await upsertPlayer(p, client);
  for (const s of data.sessions) await upsertSession(s, client);
  for (const ps of data.playerSessions) await upsertPlayerSession(ps, client);
  await client.query('COMMIT');

  console.log(
    `Seed completado: 1 equipo, ${data.players.length} jugadores, ${data.sessions.length} sesiones, ` +
      `${data.playerSessions.length} registros de métricas, ${data.thresholds.length} umbrales.`,
  );
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Error en el seed (rollback aplicado):', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
