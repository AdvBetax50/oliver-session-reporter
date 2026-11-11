// Carga los datos de db/seeds/data.json en la base de datos.
// 1. Valida todo el JSON y lo convierte en DTOs (sin tocar la BD).
// 2. Inserta mediante los repositorios en una sola transacción (o se carga todo o nada).
// 3. Idempotente: los repositorios usan UPSERT, se puede ejecutar varias veces.
import { pool, connectOrExit } from '../src/db/pool.js';
import { readSeedFile, seedDatabase } from '../src/db/setup.js';

let raw;
try {
  raw = await readSeedFile();
} catch (err) {
  console.error(`No se pudo leer el JSON de seed: ${err.message}`);
  process.exit(1);
}

const client = await connectOrExit();
try {
  const result = await seedDatabase(client, raw);
  result.warnings.forEach((w) => console.warn(`⚠ ${w}`));
  console.log(
    `Seed completado: 1 equipo, ${result.players} jugadores, ${result.sessions} sesiones, ` +
      `${result.playerSessions} registros de métricas, ${result.thresholds} umbrales.`,
  );
} catch (err) {
  const kind = err.name === 'ValidationError' ? 'JSON inválido' : 'Error en el seed (rollback aplicado)';
  console.error(`${kind}: ${err.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
