import pg from 'pg';

// DATE (OID 1082) se devuelve como string 'YYYY-MM-DD'. Por defecto pg lo convierte
// a Date en la zona horaria local, lo que puede desplazar el día.
pg.types.setTypeParser(1082, (value) => value);

// pg lee PGHOST, PGPORT, PGUSER, PGPASSWORD y PGDATABASE del entorno.
export const pool = new pg.Pool({
  database: process.env.PGDATABASE || 'oliver',
  max: Number(process.env.PG_POOL_MAX) || 10,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

export const query = (text, params) => pool.query(text, params);

// Para scripts CLI: obtiene un cliente o termina con un mensaje legible.
export async function connectOrExit() {
  try {
    return await pool.connect();
  } catch (err) {
    console.error(`No se pudo conectar a PostgreSQL (${err.code ?? 'sin código'}): ${err.message}`);
    console.error('Revisa PGUSER / PGPASSWORD / PGHOST en apps/server/.env');
    await pool.end();
    process.exit(1);
  }
}
