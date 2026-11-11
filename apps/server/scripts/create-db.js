// Crea la base de datos (PGDATABASE, por defecto "oliver") si no existe.
import { ensureDatabase } from '../src/db/setup.js';

const dbName = process.env.PGDATABASE || 'oliver';

try {
  const created = await ensureDatabase(dbName);
  console.log(created ? `Base de datos "${dbName}" creada.` : `La base de datos "${dbName}" ya existe.`);
} catch (err) {
  console.error('Error creando la base de datos:', err.message);
  process.exitCode = 1;
}
