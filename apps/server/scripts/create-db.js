// Crea la base de datos "oliver" si no existe.
// Se conecta a la base de mantenimiento "postgres" porque no se puede crear
// una base de datos estando conectado a ella misma.
import pg from 'pg';

const dbName = process.env.PGDATABASE || 'oliver';
const client = new pg.Client({
  database: 'postgres',
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

try {
  await client.connect();
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (rowCount) {
    console.log(`La base de datos "${dbName}" ya existe.`);
  } else {
    await client.query(`CREATE DATABASE ${pg.escapeIdentifier(dbName)}`);
    console.log(`Base de datos "${dbName}" creada.`);
  }
} catch (err) {
  console.error('Error creando la base de datos:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
