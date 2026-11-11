// Ejecuta en orden los archivos .sql de db/migrations que aún no se han aplicado.
// Cada migración corre dentro de una transacción y queda registrada en schema_migrations.
import { pool, connectOrExit } from '../src/db/pool.js';
import { runMigrations } from '../src/db/setup.js';

const client = await connectOrExit();
try {
  const applied = await runMigrations(client);
  applied.forEach((file) => console.log(`✔ ${file}`));
  console.log('Migraciones al día.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
