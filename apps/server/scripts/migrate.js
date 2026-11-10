// Ejecuta en orden los archivos .sql de db/migrations que aún no se han aplicado.
// Cada migración corre dentro de una transacción y queda registrada en schema_migrations.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, connectOrExit } from '../src/db/pool.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

const client = await connectOrExit();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const { rows } = await client.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(dir, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`✔ ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Falló la migración ${file}: ${err.message}`);
    }
  }
  console.log('Migraciones al día.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
